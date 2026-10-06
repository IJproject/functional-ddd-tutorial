import type { Case } from "#/domain/building-blocks";
import type {
	FailedInvoice,
	PaidInvoice,
} from "#/domain/subscription/model/invoice.entity";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// 入力
// ===========================================================================

/** 決済サービスの結果。ChargeInvoice ポートの実装が返す。 */
export type PaymentOutcome = Case<"Succeeded"> | Case<"Failed">;

// ===========================================================================
// イベント
// ===========================================================================

export type PaymentSettled = Case<
	"PaymentSettled",
	{ subscription: Subscription; invoice: PaidInvoice | FailedInvoice }
>;

// ===========================================================================
// エラー
// ===========================================================================

export type PayInvoiceError = InvoiceAlreadyProcessed | NoPendingPayment;

/**
 * 決済ゲートウェイに到達できなかった、業務上の結果ではない境界の失敗。
 * 決済が拒否されたこと（PaymentOutcome の Failed）とは別で、請求を失敗として確定させない。
 */
export type PaymentGatewayError = Case<
	"PaymentGatewayUnavailable",
	{ reason: string }
>;

export const PaymentGatewayError = {
	paymentGatewayUnavailable: (reason: string): PaymentGatewayError => ({
		kind: "PaymentGatewayUnavailable",
		reason,
	}),
};

/** 支払い対象の請求が存在しない。 */
export type InvoiceNotFound = Case<"InvoiceNotFound">;

/** 支払い済みまたは失敗済みの請求は再処理しない。 */
export type InvoiceAlreadyProcessed = Case<"InvoiceAlreadyProcessed">;

/** 契約に処理対象となる支払い待ち状態がない。 */
export type NoPendingPayment = Case<"NoPendingPayment">;
