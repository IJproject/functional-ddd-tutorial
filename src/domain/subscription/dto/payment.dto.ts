import * as z from "zod";
import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	InvoiceNotFound,
	PayInvoiceError,
	PaymentOutcome,
	PaymentSettled,
} from "#/domain/subscription/model/payment.model";
import type { StoreError } from "#/domain/subscription/model/store.model";

// ===========================================================================
// 型定義（デシリアライズ: JSON → DTO）
// ===========================================================================

export const payInvoiceCommandSchema = z.object({
	invoiceId: z.string(),
	result: z.enum(["success", "failure"]),
});
export type PayInvoiceCommand = z.infer<typeof payInvoiceCommandSchema>;

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type PaymentResponse = { ok: true } | { ok: false; message: string };

// ===========================================================================
// decode（DTO → ドメイン）
// ===========================================================================

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

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** ドメインの結果 → PaymentResponse。 */
export const encodePaymentResponse = (
	result: ResultType<
		PaymentSettled,
		PayInvoiceError | InvoiceNotFound | StoreError
	>,
): PaymentResponse =>
	Result.match<
		PaymentSettled,
		PayInvoiceError | InvoiceNotFound | StoreError,
		PaymentResponse
	>(result, {
		ok: () => ({ ok: true }),
		err: (error) => ({
			ok: false,
			message: matchChoice<
				PayInvoiceError | InvoiceNotFound | StoreError,
				string
			>(error, {
				InvoiceAlreadyProcessed: () => "この請求はすでに処理済みです",
				NoPendingPayment: () => "支払い待ちの請求がありません",
				InvoiceNotFound: () => INVOICE_NOT_FOUND_MESSAGE,
				MalformedSubscription: () => MALFORMED_STORED_DATA_MESSAGE,
				MalformedInvoice: () => MALFORMED_STORED_DATA_MESSAGE,
			}),
		}),
	});

export const UNEXPECTED_PAYMENT_RESPONSE: Extract<
	PaymentResponse,
	{ ok: false }
> = {
	ok: false,
	message: "操作に失敗しました",
};

export const AUTHENTICATION_REQUIRED_PAYMENT_RESPONSE: Extract<
	PaymentResponse,
	{ ok: false }
> = {
	ok: false,
	message: "ログインしてください",
};

/** ポートが請求を見つけられなかったときの境界層の文言。 */
const INVOICE_NOT_FOUND_MESSAGE = "請求が見つかりません";
const MALFORMED_STORED_DATA_MESSAGE = "契約情報を読み込めませんでした";
