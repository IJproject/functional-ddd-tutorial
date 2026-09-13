import * as z from "zod";
import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	PayInvoiceError,
	PaymentOutcome,
	PaymentSettled,
} from "#/domain/subscription/model/payment.model";

// ===========================================================================
// 型定義
// ===========================================================================

export const payInvoiceCommandSchema = z.object({
	invoiceId: z.string(),
	result: z.enum(["success", "failure"]),
});
export type PayInvoiceCommand = z.infer<typeof payInvoiceCommandSchema>;

export type PaymentResponse = { ok: true } | { ok: false; message: string };

// ===========================================================================
// 実装
// ===========================================================================

/** ポートが請求を見つけられなかったときの境界層の文言。 */
export const INVOICE_NOT_FOUND_MESSAGE = "請求が見つかりません";

/** 境界の決済結果 → ドメインの PaymentOutcome。 */
export const decodePaymentOutcome = (
	command: PayInvoiceCommand,
): PaymentOutcome =>
	matchChoice<{ kind: "success" } | { kind: "failure" }, PaymentOutcome>(
		{ kind: command.result },
		{
			success: () => ({ kind: "Succeeded" }),
			failure: () => ({ kind: "Failed" }),
		},
	);

/** ドメインの結果 → PaymentResponse。 */
export const encodePaymentResponse = (
	result: ResultType<PaymentSettled, PayInvoiceError>,
): PaymentResponse =>
	Result.match<PaymentSettled, PayInvoiceError, PaymentResponse>(result, {
		ok: () => ({ ok: true }),
		err: (error) => ({
			ok: false,
			message: matchChoice<PayInvoiceError, string>(error, {
				InvoiceAlreadyProcessed: () => "この請求はすでに処理済みです",
				NoPendingPayment: () => "支払い待ちの請求がありません",
			}),
		}),
	});
