import type { Session } from "#/domain/auth/model/session.model";
import { matchChoice, Result } from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import {
	InvoiceDetailItemView,
	InvoiceDetailRequest,
	type InvoiceDetailView,
} from "#/domain/subscription/operation/invoice-detail/invoice-detail.dto";
import { currentSession } from "#/external/better-auth/current-session";
import { findInvoice } from "#/external/subscription-store/subscription-store";

/** 請求の詳細。読む → encode。 */
export const invoiceDetail = async (
	request: InvoiceDetailRequest,
): Promise<InvoiceDetailView> => {
	const session = await currentSession();
	return matchChoice<Session, Promise<InvoiceDetailView>>(session, {
		AnonymousSession: async () => ({ kind: "AnonymousInvoiceDetail" }),
		AuthenticatedSession: async ({ userId }) =>
			Result.match(InvoiceDetailRequest.decode(request), {
				/**
				 * 形式不正・存在しない・他アカウント所有を区別すると、URL の総当たりから
				 * 他人の請求 ID の存在を推測できるため、すべて InvoiceNotFound に落とす。
				 */
				err: async (): Promise<InvoiceDetailView> => ({
					kind: "InvoiceNotFound",
				}),
				ok: async (invoiceId): Promise<InvoiceDetailView> => {
					const loaded = await findInvoice(toAccountId(userId), invoiceId);
					return Result.match(loaded, {
						err: () => {
							// 読み取りの View は失敗の形を持たないため reject させ、クライアントの catch が INVOICE_DETAIL_UNAVAILABLE_MESSAGE を表示する。
							// StoreError の reason は内部情報なので例外にも載せない。
							throw new Error();
						},
						ok: (invoice): InvoiceDetailView =>
							invoice === null
								? { kind: "InvoiceNotFound" }
								: {
										kind: "InvoiceFound",
										invoice: InvoiceDetailItemView.encode(invoice),
									},
					});
				},
			}),
	});
};
