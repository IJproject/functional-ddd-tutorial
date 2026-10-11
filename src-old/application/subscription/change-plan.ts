import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	matchChoice,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import {
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import type { StoreError } from "#/domain/subscription/model/store.model";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import {
	ChangePlanRequest,
	ChangePlanResponse,
} from "#/domain/subscription/operation/change-plan/change-plan.dto";
import type { PlanChanged } from "#/domain/subscription/operation/change-plan/change-plan.model";
import { createChangePlanWorkflow } from "#/domain/subscription/operation/change-plan/change-plan.workflow";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadSubscription,
	savePlanChanged,
} from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込む。
const newInvoiceId = () => InvoiceId.create(crypto.randomUUID());
const issuedAt = () => IssuedAt.create(new Date());
const changePlanWorkflow = createChangePlanWorkflow({ newInvoiceId, issuedAt });

/** プラン変更。読む → 純粋な核 → 書く → encode。 */
export const changePlan = async (
	request: ChangePlanRequest,
): Promise<ChangePlanResponse> => {
	return Result.match(await currentSession(), {
		err: async () => ChangePlanResponse.unexpected,
		ok: (session) =>
			matchChoice<Session, Promise<ChangePlanResponse>>(session, {
				AnonymousSession: async () => ChangePlanResponse.authenticationRequired,
				AuthenticatedSession: async ({ userId }) => {
					const accountId = toAccountId(userId);
					return pipe(
						loadSubscription(accountId),
						AsyncResult.map((found) => Subscription.orFree(found, accountId)),
						AsyncResult.flatMap((subscription) =>
							changePlanWorkflow(
								ChangePlanRequest.decode(request),
								subscription,
							),
						),
						AsyncResult.flatMap<PlanChanged, PlanChanged, StoreError>(
							(changed) =>
								pipe(
									savePlanChanged(changed),
									AsyncResult.map(() => changed),
								),
						),
						async (result) => ChangePlanResponse.encode(await result),
					);
				},
			}),
	});
};
