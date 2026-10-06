import type { Session } from "#/domain/auth/model/session.model";
import { AsyncResult, matchChoice, Result } from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import { SubscriptionView } from "#/domain/subscription/operation/subscription-view/subscription-view.dto";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadInvoices,
	loadSubscription,
} from "#/external/subscription-store/subscription-store";

/** 契約表示。読む → encode。 */
export const subscriptionView = async (): Promise<SubscriptionView> => {
	return Result.match(await currentSession(), {
		err: async (): Promise<SubscriptionView> => ({
			kind: "SubscriptionUnavailable",
		}),
		ok: (session) =>
			matchChoice<Session, Promise<SubscriptionView>>(session, {
				AnonymousSession: async () => ({ kind: "AnonymousSubscription" }),
				AuthenticatedSession: async ({ userId }) => {
					const accountId = toAccountId(userId);
					const [subscription, invoices] = await Promise.all([
						AsyncResult.map<Subscription | null, Subscription>((found) =>
							Subscription.orFree(found, accountId),
						)(loadSubscription(accountId)),
						loadInvoices(accountId),
					]);
					return Result.match(Result.combine([subscription, invoices]), {
						err: (): SubscriptionView => ({ kind: "SubscriptionUnavailable" }),
						ok: ([domainSubscription, domainInvoices]) =>
							SubscriptionView.encode(domainSubscription, domainInvoices),
					});
				},
			}),
	});
};
