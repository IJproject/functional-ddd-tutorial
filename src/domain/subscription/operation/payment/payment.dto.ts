import * as z from "zod";
import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { StoreError } from "#/domain/subscription/model/store.model";
import type {
	InvoiceNotFound,
	PayInvoiceError,
	PaymentGatewayError,
	PaymentSettled,
} from "#/domain/subscription/operation/payment/payment.model";

// ===========================================================================
// 型定義（デシリアライズ: JSON → DTO）
// ===========================================================================

const payInvoiceRequestSchema = z.object({
	invoiceId: z.string(),
});
export type PayInvoiceRequest = z.infer<typeof payInvoiceRequestSchema>;

// ===========================================================================
// decode（DTO → ドメイン）
// ===========================================================================

export const PayInvoiceRequest = { schema: payInvoiceRequestSchema };

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** ドメインの結果 → PaymentResponse。 */
export const PaymentResponse = {
	encode: (
		result: ResultType<
			PaymentSettled,
			PayInvoiceError | PaymentGatewayError | InvoiceNotFound | StoreError
		>,
	): PaymentResponse =>
		Result.match<
			PaymentSettled,
			PayInvoiceError | PaymentGatewayError | InvoiceNotFound | StoreError,
			PaymentResponse
		>(result, {
			ok: () => ({ ok: true }),
			err: (error) => ({
				ok: false,
				message: matchChoice<
					PayInvoiceError | PaymentGatewayError | InvoiceNotFound | StoreError,
					string
				>(error, {
					InvoiceAlreadyProcessed: () => "この請求はすでに処理済みです",
					NoPendingPayment: () => "支払い待ちの請求がありません",
					InvoiceNotFound: () => INVOICE_NOT_FOUND_MESSAGE,
					MalformedSubscription: () => MALFORMED_STORED_DATA_MESSAGE,
					MalformedInvoice: () => MALFORMED_STORED_DATA_MESSAGE,
					StoreUnavailable: () => STORE_UNAVAILABLE_MESSAGE,
					PaymentGatewayUnavailable: () => PAYMENT_GATEWAY_UNAVAILABLE_MESSAGE,
				}),
			}),
		}),
	unexpected: {
		ok: false,
		message: "操作に失敗しました",
	} satisfies Extract<PaymentResponse, { ok: false }>,
	authenticationRequired: {
		ok: false,
		message: "ログインしてください",
	} satisfies Extract<PaymentResponse, { ok: false }>,
};

/** ポートが請求を見つけられなかったときの境界層の文言。 */
const INVOICE_NOT_FOUND_MESSAGE = "請求が見つかりません";
const MALFORMED_STORED_DATA_MESSAGE = "契約情報を読み込めませんでした";
const STORE_UNAVAILABLE_MESSAGE = "時間をおいてもう一度お試しください";
const PAYMENT_GATEWAY_UNAVAILABLE_MESSAGE =
	"時間をおいてもう一度お試しください";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type PaymentResponse = { ok: true } | { ok: false; message: string };
