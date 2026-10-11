import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	matchChoice,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { TrialUsedAt } from "#/domain/subscription/model/account.primitive";
import {
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import type { StoreError } from "#/domain/subscription/model/store.model";
import {
	ApplyRequest,
	ApplyResponse,
} from "#/domain/subscription/operation/apply/apply.dto";
import {
	type Applied,
	ApplyContext,
} from "#/domain/subscription/operation/apply/apply.model";
import { createApplyWorkflow } from "#/domain/subscription/operation/apply/apply.workflow";
import { ApplyView } from "#/domain/subscription/operation/apply/apply-view.dto";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadApplyContext,
	saveApplied,
} from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込む。
const applyWorkflow = createApplyWorkflow({
	newInvoiceId: () => InvoiceId.create(crypto.randomUUID()),
	issuedAt: () => IssuedAt.create(new Date()),
	trialUsedAt: () => TrialUsedAt.create(new Date()),
});

/** 申込画面の状態。読む → encode。 */
export const applyView = async (): Promise<ApplyView> => {
	return Result.match(await currentSession(), {
		err: async (): Promise<ApplyView> => ApplyView.unavailable,
		ok: (session) =>
			matchChoice<Session, Promise<ApplyView>>(session, {
				AnonymousSession: async () => ApplyView.anonymous,
				AuthenticatedSession: async ({ userId }) => {
					const accountId = toAccountId(userId);
					const loaded = await loadApplyContext(accountId);
					return Result.match(loaded, {
						err: (): ApplyView => ApplyView.unavailable,
						ok: (found) => {
							const context = ApplyContext.of(found, accountId);
							return ApplyView.encode(context.account, context.subscription);
						},
					});
				},
			}),
	});
};

/** サブスク申込。読む → 純粋な核 → 書く → encode。 */
export const apply = async (request: ApplyRequest): Promise<ApplyResponse> => {
	return Result.match(await currentSession(), {
		err: async () => ApplyResponse.unexpected,
		ok: (session) =>
			matchChoice<Session, Promise<ApplyResponse>>(session, {
				AnonymousSession: async () => ApplyResponse.authenticationRequired,
				AuthenticatedSession: async ({ userId }) => {
					const accountId = toAccountId(userId);
					return pipe(
						loadApplyContext(accountId),
						AsyncResult.map((found) => ApplyContext.of(found, accountId)),
						AsyncResult.flatMap((context) =>
							applyWorkflow(ApplyRequest.decode(request), context),
						),
						AsyncResult.flatMap<Applied, Applied, StoreError>((applied) =>
							pipe(
								saveApplied(applied),
								AsyncResult.map(() => applied),
							),
						),
						async (result) => ApplyResponse.encode(await result),
					);
				},
			}),
	});
};
