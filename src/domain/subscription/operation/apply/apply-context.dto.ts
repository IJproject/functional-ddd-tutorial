import { matchChoice } from "#/domain/building-blocks";
import type { Account } from "#/domain/subscription/model/account.entity";
import { Plan } from "#/domain/subscription/model/plan.entity";
import {
	MonthlyPrice,
	PlanId,
} from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** Account と Subscription → 申し込み画面専用の表示モデル。 */
export const encodeApplyContextView = (
	account: Account,
	subscription: Subscription,
): ApplyContextView => ({
	loggedIn: true,
	applicable: matchChoice<Subscription, boolean>(subscription, {
		FreeSubscription: () => true,
		TrialSubscription: () => false,
		PendingPaymentSubscription: () => false,
		PaidSubscription: () => false,
		UpgradePendingSubscription: () => false,
		CancelReservedSubscription: () => false,
		PlanChangeReservedSubscription: () => false,
	}),
	trialUsed: matchChoice<Account, boolean>(account, {
		TrialUnusedAccount: () => false,
		TrialUsedAccount: () => true,
	}),
	plans: Plan.all().map((plan) => ({
		id: PlanId.value(plan.id),
		name: planName(plan.id),
		monthlyPrice: MonthlyPrice.value(plan.monthlyPrice),
	})),
});

/** トライアル利用状況に応じた画面表示。日数を UI に重複させない。 */
export const TRIAL_AVAILABLE_MESSAGE = "14日間の無料トライアルが始まります";
export const PAYMENT_REQUIRED_MESSAGE = "請求が作成されます";
export const APPLY_CONTEXT_UNAVAILABLE_MESSAGE =
	"契約情報を読み込めませんでした";
export const APPLY_LOGIN_REQUIRED_MESSAGE = "ログインしてください。";
export const ALREADY_SUBSCRIBED_APPLY_MESSAGE =
	"すでに契約中のため申し込みできません。";

const planName = (planId: PlanId): string =>
	matchChoice<{ kind: "Basic" } | { kind: "Pro" }, string>(
		{ kind: PlanId.value(planId) },
		{
			Basic: () => "ベーシック",
			Pro: () => "プロ",
		},
	);

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type ApplyPlanView = {
	id: string;
	name: string;
	monthlyPrice: number;
};

/** 申し込み画面が必要とする状態。 */
export type ApplyContextView =
	| { loggedIn: false }
	| {
			loggedIn: true;
			/** 申し込み可能か。契約中なら false。 */
			applicable: boolean;
			/** トライアル使用済みか。文言の出し分けに使う。 */
			trialUsed: boolean;
			plans: ApplyPlanView[];
	  };
