import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	matchChoice,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import type { StoreError } from "#/domain/subscription/model/store.model";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import { createEndPeriodWorkflow } from "#/domain/subscription/operation/schedule/end-period.workflow";
import { createEndTrialWorkflow } from "#/domain/subscription/operation/schedule/end-trial.workflow";
import {
	EndPeriodResponse,
	EndTrialResponse,
} from "#/domain/subscription/operation/schedule/schedule.dto";
import type {
	PeriodEnded,
	TrialEnded,
} from "#/domain/subscription/operation/schedule/schedule.model";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadSubscription,
	savePeriodEnded,
	saveTrialEnded,
} from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込む。
const newInvoiceId = () => InvoiceId.create(crypto.randomUUID());
const now = () => new Date();
const endTrialWorkflow = createEndTrialWorkflow({ newInvoiceId, now });
const endPeriodWorkflow = createEndPeriodWorkflow({ newInvoiceId, now });

/** トライアル終了。読む → 純粋な核 → 書く → encode。 */
export const endTrial = async (): Promise<EndTrialResponse> => {
	return Result.match(await currentSession(), {
		err: async () => EndTrialResponse.unexpected,
		ok: (session) =>
			matchChoice<Session, Promise<EndTrialResponse>>(session, {
				AnonymousSession: async () => EndTrialResponse.authenticationRequired,
				AuthenticatedSession: async ({ userId }) => {
					const accountId = toAccountId(userId);
					return pipe(
						loadSubscription(accountId),
						AsyncResult.map((found) => Subscription.orFree(found, accountId)),
						AsyncResult.flatMap(endTrialWorkflow),
						AsyncResult.flatMap<TrialEnded, TrialEnded, StoreError>((ended) =>
							pipe(
								saveTrialEnded(ended),
								AsyncResult.map(() => ended),
							),
						),
						async (result) => EndTrialResponse.encode(await result),
					);
				},
			}),
	});
};

/** 期間満了。読む → 純粋な核 → 書く → encode。 */
export const endPeriod = async (): Promise<EndPeriodResponse> => {
	return Result.match(await currentSession(), {
		err: async () => EndPeriodResponse.unexpected,
		ok: (session) =>
			matchChoice<Session, Promise<EndPeriodResponse>>(session, {
				AnonymousSession: async () => EndPeriodResponse.authenticationRequired,
				AuthenticatedSession: async ({ userId }) => {
					const accountId = toAccountId(userId);
					return pipe(
						loadSubscription(accountId),
						AsyncResult.map((found) => Subscription.orFree(found, accountId)),
						AsyncResult.flatMap(endPeriodWorkflow),
						AsyncResult.flatMap<PeriodEnded, PeriodEnded, StoreError>((ended) =>
							pipe(
								savePeriodEnded(ended),
								AsyncResult.map(() => ended),
							),
						),
						async (result) => EndPeriodResponse.encode(await result),
					);
				},
			}),
	});
};
