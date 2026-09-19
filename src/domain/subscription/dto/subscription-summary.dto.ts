import { matchChoice } from "#/domain/building-blocks";
import { PlanId } from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

/** ホーム画面のように、契約の要約だけが要る画面のための表示モデル。 */
export type SubscriptionSummaryView = {
	statusLabel: string;
	/** 契約中のプラン名。FreeSubscription なら null。 */
	planName: string | null;
};

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** 契約状態の要約。 */
export const encodeSubscriptionSummaryView = (
	subscription: Subscription,
): SubscriptionSummaryView =>
	matchChoice<Subscription, SubscriptionSummaryView>(subscription, {
		FreeSubscription: () => ({
			statusLabel: "無料プラン",
			planName: null,
		}),
		TrialSubscription: (current) => ({
			statusLabel: "トライアル中",
			planName: planName(current.planId),
		}),
		PendingPaymentSubscription: (current) => ({
			statusLabel: "支払い待ち",
			planName: planName(current.planId),
		}),
		PaidSubscription: (current) => ({
			statusLabel: "有料契約中",
			planName: planName(current.planId),
		}),
		UpgradePendingSubscription: (current) => ({
			statusLabel: "有料契約中",
			planName: planName(current.planId),
		}),
		CancelReservedSubscription: (current) => ({
			statusLabel: "有料契約中",
			planName: planName(current.planId),
		}),
		PlanChangeReservedSubscription: (current) => ({
			statusLabel: "有料契約中",
			planName: planName(current.planId),
		}),
	});

export const SUBSCRIPTION_SUMMARY_UNAVAILABLE_MESSAGE =
	"契約情報を読み込めませんでした";

const planName = (planId: PlanId): string =>
	matchChoice<{ kind: "Basic" } | { kind: "Pro" }, string>(
		{ kind: PlanId.value(planId) },
		{
			Basic: () => "ベーシック",
			Pro: () => "プロ",
		},
	);
