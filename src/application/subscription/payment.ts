import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	err,
	matchChoice,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import type { StoreError } from "#/domain/subscription/model/store.model";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import {
	type PayInvoiceRequest,
	PaymentResponse,
} from "#/domain/subscription/operation/payment/payment.dto";
import type {
	InvoiceNotFound,
	PayInvoiceError,
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
const now = () => new Date();

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
					const [invoice, subscription] = await Promise.all([
						findInvoice(accountId, InvoiceId.create(request.invoiceId)),
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
								PayInvoiceError | InvoiceNotFound
							> =>
								domainInvoice === null
									? Promise.resolve(
											err<InvoiceNotFound>({ kind: "InvoiceNotFound" }),
										)
									: payInvoiceWorkflow(domainInvoice, domainSubscription, {
											now: now(),
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
