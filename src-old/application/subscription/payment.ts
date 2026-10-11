import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	matchChoice,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import type { Invoice } from "#/domain/subscription/model/invoice.entity";
import {
	type InvoiceId,
	PaidAt,
} from "#/domain/subscription/model/invoice.primitive";
import type { StoreError } from "#/domain/subscription/model/store.model";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import {
	PayInvoiceRequest,
	PaymentResponse,
} from "#/domain/subscription/operation/payment/payment.dto";
import type { PaymentSettled } from "#/domain/subscription/operation/payment/payment.model";
import { createPayInvoiceWorkflow } from "#/domain/subscription/operation/payment/payment.workflow";
import { currentSession } from "#/external/better-auth/current-session";
import { chargeInvoice } from "#/external/payment-gateway/charge-invoice";
import {
	findInvoice,
	loadSubscription,
	savePaymentSettled,
} from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込む。
const payInvoiceWorkflow = createPayInvoiceWorkflow({
	chargeInvoice,
	paidAt: () => PaidAt.create(new Date()),
});

/** 請求の支払い。読む → 純粋な核 → 書く → encode。 */
export const payInvoice = async (
	request: PayInvoiceRequest,
): Promise<PaymentResponse> => {
	return Result.match(await currentSession(), {
		err: async () => PaymentResponse.unexpected,
		ok: (session) =>
			matchChoice<Session, Promise<PaymentResponse>>(session, {
				AnonymousSession: async () => PaymentResponse.authenticationRequired,
				AuthenticatedSession: async ({ userId }) => {
					const accountId = toAccountId(userId);
					return pipe(
						PayInvoiceRequest.decode(request),
						AsyncResult.flatMap((invoiceId) =>
							loadPayment(accountId, invoiceId),
						),
						AsyncResult.flatMap(({ invoice, subscription }) =>
							payInvoiceWorkflow(invoice, subscription),
						),
						AsyncResult.flatMap<PaymentSettled, PaymentSettled, StoreError>(
							(settled) =>
								pipe(
									savePaymentSettled(settled),
									AsyncResult.map(() => settled),
								),
						),
						async (result) => PaymentResponse.encode(await result),
					);
				},
			}),
	});
};

/** 支払いに必要な請求と契約を並行して読む。請求が無ければ null のまま渡し、意味はワークフローが決める。 */
const loadPayment = async (
	accountId: AccountId,
	invoiceId: InvoiceId,
): AsyncResult<
	{ invoice: Invoice | null; subscription: Subscription },
	StoreError
> => {
	const [invoice, subscription] = await Promise.all([
		findInvoice(accountId, invoiceId),
		pipe(
			loadSubscription(accountId),
			AsyncResult.map((found) => Subscription.orFree(found, accountId)),
		),
	]);
	return pipe(
		Result.combine([invoice, subscription] as const),
		Result.map(([found, current]) => ({
			invoice: found,
			subscription: current,
		})),
	);
};
