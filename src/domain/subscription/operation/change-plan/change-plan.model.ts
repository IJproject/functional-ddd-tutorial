import type { Case } from "#/domain/building-blocks";
import type { UnpaidInvoice } from "#/domain/subscription/model/invoice.entity";
import type {
	PlanId,
	PlanIdError,
} from "#/domain/subscription/model/plan.model";
import type {
	PendingPaymentSubscription,
	PlanChangeReservedSubscription,
	UpgradePendingSubscription,
} from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// 入力
// ===========================================================================

/** 信頼境界を越えてきた、まだドメインの型へ変換していないプラン変更入力。 */
export type UnvalidatedChangePlanCommand = { planId: string };

/** ドメインの primitive へ変換済みのプラン変更入力。 */
export type ValidatedChangePlanCommand = { planId: PlanId };

// ===========================================================================
// イベント
// ===========================================================================

/** プラン変更の結果。到達する状態が3通りに分かれるので Case で表す。 */
export type PlanChanged =
	| PaymentRequested
	| UpgradeRequested
	| PlanChangeReserved;

export type PaymentRequested = Case<
	"PaymentRequested",
	{ subscription: PendingPaymentSubscription; invoice: UnpaidInvoice }
>;

export type UpgradeRequested = Case<
	"UpgradeRequested",
	{ subscription: UpgradePendingSubscription; invoice: UnpaidInvoice }
>;

export type PlanChangeReserved = Case<
	"PlanChangeReserved",
	{ subscription: PlanChangeReservedSubscription }
>;

// ===========================================================================
// エラー
// ===========================================================================

export type ChangePlanError =
	| ValidationFailed
	| NotSubscribed
	| PaymentPending
	| ReservationExists
	| SamePlan;

/** 入力値の形式が不正。 */
export type ValidationFailed = Case<
	"ValidationFailed",
	{ reason: PlanIdError }
>;

/** 無料状態では変更元のプランが存在しない。 */
export type NotSubscribed = Case<"NotSubscribed">;

/** 現在と同じプランへの変更は受け付けない。 */
export type SamePlan = Case<"SamePlan">;

/** 支払い待ちの請求がある。新規契約・アップグレード差額のどちらも。 */
export type PaymentPending = Case<"PaymentPending">;

/** 解約またはプラン変更の予約がすでにある。 */
export type ReservationExists = Case<"ReservationExists">;
