import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	matchChoice,
	ok,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import {
	ApplyRequest,
	ApplyResponse,
} from "#/domain/subscription/operation/apply/apply.dto";
import type { Applied } from "#/domain/subscription/operation/apply/apply.model";
import { createApplyWorkflow } from "#/domain/subscription/operation/apply/apply.workflow";
import { ApplyContextView } from "#/domain/subscription/operation/apply/apply-context.dto";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadApplyContext,
	saveApplied,
} from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込む。
const applyWorkflow = createApplyWorkflow({
	newInvoiceId: () => InvoiceId.create(crypto.randomUUID()),
	now: () => new Date(),
});

/** 申込画面の状態。読む → encode。 */
export const applyContext = async (): Promise<ApplyContextView> => {
	const session = await currentSession();
	return matchChoice<Session, Promise<ApplyContextView>>(session, {
		AnonymousSession: async () => ({ loggedIn: false }),
		AuthenticatedSession: async ({ userId }) => {
			const loaded = await loadApplyContext(toAccountId(userId));
			return Result.match(loaded, {
				err: () => {
					// 読み取りの View は失敗の形を持たないため reject させ、クライアントの catch が APPLY_CONTEXT_UNAVAILABLE_MESSAGE を表示する。
					// StoreError の reason は内部情報なので例外にも載せない。
					throw new Error();
				},
				ok: (context) =>
					ApplyContextView.encode(context.account, context.subscription),
			});
		},
	});
};

/** サブスク申込。読む → 純粋な核 → 書く → encode。 */
export const apply = async (request: ApplyRequest): Promise<ApplyResponse> => {
	const session = await currentSession();
	return matchChoice<Session, Promise<ApplyResponse>>(session, {
		AnonymousSession: async () => ApplyResponse.authenticationRequired,
		AuthenticatedSession: async ({ userId }) => {
			const accountId = toAccountId(userId);
			return pipe(
				loadApplyContext(accountId),
				AsyncResult.flatMap((context) =>
					applyWorkflow(
						ApplyRequest.decode(request, AccountId.value(accountId)),
						context,
					),
				),
				AsyncResult.flatMap<Applied, Applied, never>(async (applied) => {
					await saveApplied(applied);
					return ok(applied);
				}),
				async (result) => ApplyResponse.encode(await result),
			);
		},
	});
};
