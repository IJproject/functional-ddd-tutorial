import type { Case } from "#/domain/building-blocks";
import type {
	FailedInvoice,
	PaidInvoice,
} from "#/domain/subscription/model/invoice.entity";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// 入力
// ===========================================================================

/** 決済サービスの結果。実サービスの代わりに境界層が与える。 */
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

/** 支払い対象の請求が存在しない。 */
export type InvoiceNotFound = Case<"InvoiceNotFound">;

/** 支払い済みまたは失敗済みの請求は再処理しない。 */
export type InvoiceAlreadyProcessed = Case<"InvoiceAlreadyProcessed">;

/** 契約に処理対象となる支払い待ち状態がない。 */
export type NoPendingPayment = Case<"NoPendingPayment">;
