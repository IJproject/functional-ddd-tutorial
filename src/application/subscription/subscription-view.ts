import type { Session } from "#/domain/auth/model/session.model";
import { matchChoice, Result } from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { SubscriptionView } from "#/domain/subscription/operation/subscription-view/subscription-view.dto";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadInvoices,
	loadSubscription,
} from "#/external/subscription-store/subscription-store";

/** 契約表示。読む → encode。 */
export const subscriptionView = async (): Promise<SubscriptionView> => {
	const session = await currentSession();
	return matchChoice<Session, Promise<SubscriptionView>>(session, {
		AnonymousSession: async () => ({ loggedIn: false }),
		AuthenticatedSession: async ({ userId }) => {
			const accountId = toAccountId(userId);
			const [subscription, invoices] = await Promise.all([
				loadSubscription(accountId),
				loadInvoices(accountId),
			]);
			return Result.match(Result.combine([subscription, invoices]), {
				err: () => {
					// 読み取りの View は失敗の形を持たないため reject させ、クライアントの catch が SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE を表示する。
					// StoreError の reason は内部情報なので例外にも載せない。
					throw new Error();
				},
				ok: ([domainSubscription, domainInvoices]) =>
					SubscriptionView.encode(domainSubscription, domainInvoices),
			});
		},
	});
};
