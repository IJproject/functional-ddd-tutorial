import type { Session } from "#/domain/auth/model/session.model";
import { AsyncResult, matchChoice, ok, pipe } from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
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
const now = () => new Date();
const changePlanWorkflow = createChangePlanWorkflow({ newInvoiceId, now });

/** プラン変更。読む → 純粋な核 → 書く → encode。 */
export const changePlan = async (
	request: ChangePlanRequest,
): Promise<ChangePlanResponse> => {
	const session = await currentSession();
	return matchChoice<Session, Promise<ChangePlanResponse>>(session, {
		AnonymousSession: async () => ChangePlanResponse.authenticationRequired,
		AuthenticatedSession: async ({ userId }) =>
			pipe(
				loadSubscription(toAccountId(userId)),
				AsyncResult.flatMap((subscription) =>
					changePlanWorkflow(ChangePlanRequest.decode(request), subscription),
				),
				AsyncResult.flatMap<PlanChanged, PlanChanged, never>(
					async (changed) => {
						await savePlanChanged(changed);
						return ok(changed);
					},
				),
				async (result) => ChangePlanResponse.encode(await result),
			),
	});
};
