import type { Case } from "#/domain/building-blocks";
import type {
	CancelReservedSubscription,
	FreeSubscription,
} from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// イベント
// ===========================================================================

export type TrialCancelled = Case<
	"TrialCancelled",
	{ subscription: FreeSubscription }
>;

export type CancellationReserved = Case<
	"CancellationReserved",
	{ subscription: CancelReservedSubscription }
>;

// ===========================================================================
// エラー
// ===========================================================================

export type CancelTrialError = NotInTrial;

/** トライアル中ではないため、トライアル解約を適用できない。 */
export type NotInTrial = Case<"NotInTrial">;

export type ReserveCancellationError = NotPaid | PaymentPending;

/** 有料契約として解約予約できる状態ではない。 */
export type NotPaid = Case<"NotPaid">;

/** 未処理のアップグレード請求がある。 */
export type PaymentPending = Case<"PaymentPending">;
