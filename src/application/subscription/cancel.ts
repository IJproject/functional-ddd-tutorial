import type { Session } from "#/domain/auth/model/session.model";
import { AsyncResult, matchChoice, ok, pipe } from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import {
	CancelTrialResponse,
	ReserveCancellationResponse,
} from "#/domain/subscription/operation/cancel/cancel.dto";
import type {
	CancellationReserved,
	TrialCancelled,
} from "#/domain/subscription/operation/cancel/cancel.model";
import {
	cancelTrial as cancelTrialForSubscription,
	createCancelTrialWorkflow,
	createReserveCancellationWorkflow,
	reserveCancellation as reserveCancellationForSubscription,
} from "#/domain/subscription/operation/cancel/cancel.workflow";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadSubscription,
	saveCancellationReserved,
	saveTrialCancelled,
} from "#/external/subscription-store/subscription-store";

// 差し込んでいるのは同じドメインの純粋関数で、external の実装も非決定性も無い。
// この2つは composition root ではなく、依存の無いワークフローの部分適用である。
const cancelTrialWorkflow = createCancelTrialWorkflow({
	cancelTrial: cancelTrialForSubscription,
});
const reserveCancellationWorkflow = createReserveCancellationWorkflow({
	reserveCancellation: reserveCancellationForSubscription,
});

/** トライアル解約。読む → 純粋な核 → 書く → encode。 */
export const cancelTrial = async (): Promise<CancelTrialResponse> => {
	const session = await currentSession();
	return matchChoice<Session, Promise<CancelTrialResponse>>(session, {
		AnonymousSession: async () => CancelTrialResponse.authenticationRequired,
		AuthenticatedSession: async ({ userId }) =>
			pipe(
				loadSubscription(toAccountId(userId)),
				AsyncResult.flatMap(cancelTrialWorkflow),
				AsyncResult.flatMap<TrialCancelled, TrialCancelled, never>(
					async (cancelled) => {
						await saveTrialCancelled(cancelled);
						return ok(cancelled);
					},
				),
				async (result) => CancelTrialResponse.encode(await result),
			),
	});
};

/** 解約予約。読む → 純粋な核 → 書く → encode。 */
export const reserveCancellation =
	async (): Promise<ReserveCancellationResponse> => {
		const session = await currentSession();
		return matchChoice<Session, Promise<ReserveCancellationResponse>>(session, {
			AnonymousSession: async () =>
				ReserveCancellationResponse.authenticationRequired,
			AuthenticatedSession: async ({ userId }) =>
				pipe(
					loadSubscription(toAccountId(userId)),
					AsyncResult.flatMap(reserveCancellationWorkflow),
					AsyncResult.flatMap<
						CancellationReserved,
						CancellationReserved,
						never
					>(async (reserved) => {
						await saveCancellationReserved(reserved);
						return ok(reserved);
					}),
					async (result) => ReserveCancellationResponse.encode(await result),
				),
		});
	};
