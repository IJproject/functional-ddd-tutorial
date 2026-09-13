import type { Case } from "#/domain/building-blocks";
import type { UnpaidInvoice } from "#/domain/subscription/model/invoice.model";
import type {
	FreeSubscription,
	PendingPaymentSubscription,
} from "#/domain/subscription/model/subscription.model";

// ===========================================================================
// 型定義
// ===========================================================================

export type TrialEnded = Case<
	"TrialEnded",
	{ subscription: PendingPaymentSubscription; invoice: UnpaidInvoice }
>;

export type EndTrialError = NotInTrial;

/** トライアル中ではないため、トライアル終了を適用できない。 */
export type NotInTrial = Case<"NotInTrial">;

/** 期間満了の結果。解約予約なら請求は立たないので Case で分ける。 */
export type PeriodEnded = SubscriptionEnded | RenewalRequested;

export type SubscriptionEnded = Case<
	"SubscriptionEnded",
	{ subscription: FreeSubscription }
>;

export type RenewalRequested = Case<
	"RenewalRequested",
	{ subscription: PendingPaymentSubscription; invoice: UnpaidInvoice }
>;

export type EndPeriodError = NotPaid | PaymentPending;

/** 有料契約として期間満了を処理できる状態ではない。 */
export type NotPaid = Case<"NotPaid">;

/** 未処理のアップグレード請求がある。 */
export type PaymentPending = Case<"PaymentPending">;
