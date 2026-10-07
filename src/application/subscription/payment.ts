import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	err,
	matchChoice,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { PaidAt } from "#/domain/subscription/model/invoice.primitive";
import type { StoreError } from "#/domain/subscription/model/store.model";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import {
	PayInvoiceRequest,
	PaymentResponse,
} from "#/domain/subscription/operation/payment/payment.dto";
import type {
	InvoiceNotFound,
	PayInvoiceError,
	PaymentGatewayError,
	PaymentSettled,
} from "#/domain/subscription/operation/payment/payment.model";
import { createPayInvoiceWorkflow } from "#/domain/subscription/operation/payment/payment.workflow";
import { currentSession } from "#/external/better-auth/current-session";
import { chargeInvoice } from "#/external/payment-gateway/charge-invoice";
import {
	findInvoice,
	loadSubscription,
	savePaymentSettled,
} from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込む。
const payInvoiceWorkflow = createPayInvoiceWorkflow({ chargeInvoice });
const paidAt = () => PaidAt.create(new Date());

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
					const decoded = PayInvoiceRequest.decode(request);
					if (decoded.tag === "err") return PaymentResponse.encode(decoded);
					const accountId = toAccountId(userId);
					const [invoice, subscription] = await Promise.all([
						findInvoice(accountId, decoded.value),
						pipe(
							loadSubscription(accountId),
							AsyncResult.map((found) => Subscription.orFree(found, accountId)),
						),
					]);
					return pipe(
						Result.combine([invoice, subscription] as const),
						AsyncResult.flatMap(
							([domainInvoice, domainSubscription]): AsyncResult<
								PaymentSettled,
								PayInvoiceError | PaymentGatewayError | InvoiceNotFound
							> =>
								domainInvoice === null
									? Promise.resolve(
											err<InvoiceNotFound>({ kind: "InvoiceNotFound" }),
										)
									: payInvoiceWorkflow(domainInvoice, domainSubscription, {
											paidAt: paidAt(),
										}),
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
