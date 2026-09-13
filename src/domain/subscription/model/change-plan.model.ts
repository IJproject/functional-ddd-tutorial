import type { Case } from "#/domain/building-blocks";
import type { UnpaidInvoice } from "#/domain/subscription/model/invoice.model";
import type { PlanId } from "#/domain/subscription/model/plan.primitive";
import type {
	PendingPaymentSubscription,
	PlanChangeReservedSubscription,
	UpgradePendingSubscription,
} from "#/domain/subscription/model/subscription.model";

// ===========================================================================
// 型定義
// ===========================================================================

/** 信頼境界を越えてきた、まだドメインの型へ変換していないプラン変更入力。 */
export type UnvalidatedChangePlanRequest = { planId: string };

/** ドメインの primitive へ変換済みのプラン変更入力。 */
export type ChangePlanRequest = { planId: PlanId };

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

export type ChangePlanError =
	| UnknownPlan
	| NotSubscribed
	| PlanChangeNotAllowed
	| PaymentPending
	| ReservationExists;

/** 指定されたプランが料金表に存在しない。 */
export type UnknownPlan = Case<"UnknownPlan">;

/** 無料状態では変更元のプランが存在しない。 */
export type NotSubscribed = Case<"NotSubscribed">;

/** 支払い待ち、または現在と同じプランへの変更は受け付けない。 */
export type PlanChangeNotAllowed = Case<"PlanChangeNotAllowed">;

/** 未処理のアップグレード請求がある。 */
export type PaymentPending = Case<"PaymentPending">;

/** 解約またはプラン変更の予約がすでにある。 */
export type ReservationExists = Case<"ReservationExists">;
