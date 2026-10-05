import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	matchChoice,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import type { StoreError } from "#/domain/subscription/model/store.model";
import {
	CancelTrialResponse,
	ReserveCancellationResponse,
} from "#/domain/subscription/operation/cancel/cancel.dto";
import type {
	CancellationReserved,
	TrialCancelled,
} from "#/domain/subscription/operation/cancel/cancel.model";
import {
	cancelTrialWorkflow,
	reserveCancellationWorkflow,
} from "#/domain/subscription/operation/cancel/cancel.workflow";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadSubscription,
	saveCancellationReserved,
	saveTrialCancelled,
} from "#/external/subscription-store/subscription-store";

/** トライアル解約。読む → 純粋な核 → 書く → encode。 */
export const cancelTrial = async (): Promise<CancelTrialResponse> => {
	return Result.match(await currentSession(), {
		err: async () => CancelTrialResponse.unexpected,
		ok: (session) =>
			matchChoice<Session, Promise<CancelTrialResponse>>(session, {
				AnonymousSession: async () =>
					CancelTrialResponse.authenticationRequired,
				AuthenticatedSession: async ({ userId }) =>
					pipe(
						loadSubscription(toAccountId(userId)),
						AsyncResult.flatMap(cancelTrialWorkflow),
						AsyncResult.flatMap<TrialCancelled, TrialCancelled, StoreError>(
							(cancelled) =>
								pipe(
									saveTrialCancelled(cancelled),
									AsyncResult.map(() => cancelled),
								),
						),
						async (result) => CancelTrialResponse.encode(await result),
					),
			}),
	});
};

/** 解約予約。読む → 純粋な核 → 書く → encode。 */
export const reserveCancellation =
	async (): Promise<ReserveCancellationResponse> => {
		return Result.match(await currentSession(), {
			err: async () => ReserveCancellationResponse.unexpected,
			ok: (session) =>
				matchChoice<Session, Promise<ReserveCancellationResponse>>(session, {
					AnonymousSession: async () =>
						ReserveCancellationResponse.authenticationRequired,
					AuthenticatedSession: async ({ userId }) =>
						pipe(
							loadSubscription(toAccountId(userId)),
							AsyncResult.flatMap(reserveCancellationWorkflow),
							AsyncResult.flatMap<
								CancellationReserved,
								CancellationReserved,
								StoreError
							>((reserved) =>
								pipe(
									saveCancellationReserved(reserved),
									AsyncResult.map(() => reserved),
								),
							),
							async (result) =>
								ReserveCancellationResponse.encode(await result),
						),
				}),
		});
	};
