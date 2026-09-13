import type { Case } from "#/domain/building-blocks";
import type {
	FailedInvoice,
	PaidInvoice,
} from "#/domain/subscription/model/invoice.model";
import type { Subscription } from "#/domain/subscription/model/subscription.model";

// ===========================================================================
// 型定義
// ===========================================================================

/** 決済サービスの結果。実サービスの代わりに境界層が与える。 */
export type PaymentOutcome = Case<"Succeeded"> | Case<"Failed">;

export type PaymentSettled = Case<
	"PaymentSettled",
	{ subscription: Subscription; invoice: PaidInvoice | FailedInvoice }
>;

export type PayInvoiceError = InvoiceAlreadyProcessed | NoPendingPayment;

/** 支払い済みまたは失敗済みの請求は再処理しない。 */
export type InvoiceAlreadyProcessed = Case<"InvoiceAlreadyProcessed">;

/** 契約に処理対象となる支払い待ち状態がない。 */
export type NoPendingPayment = Case<"NoPendingPayment">;
