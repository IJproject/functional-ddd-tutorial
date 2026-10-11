import { type Case, matchChoice } from "#/domain/building-blocks";
import type { Account } from "#/domain/subscription/model/account.entity";
import { Plan } from "#/domain/subscription/model/plan.entity";
import type { PlanId } from "#/domain/subscription/model/plan.model";
import {
	MonthlyPrice,
	PlanName,
} from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** トライアル利用状況に応じた画面表示。日数を UI に重複させない。 */
const TRIAL_AVAILABLE_MESSAGE = "14日間の無料トライアルが始まります";
const PAYMENT_REQUIRED_MESSAGE = "請求が作成されます";
export const APPLY_VIEW_UNAVAILABLE_MESSAGE = "契約情報を読み込めませんでした";
const LOGIN_REQUIRED_MESSAGE = "ログインしてください。";
const ALREADY_SUBSCRIBED_MESSAGE = "すでに契約中のため申し込みできません。";

export const ApplyView = {
	/** Account と Subscription → 申し込み画面の状態。 */
	encode: (account: Account, subscription: Subscription): ApplyView =>
		matchChoice<Subscription, ApplyView>(subscription, {
			FreeSubscription: () =>
				matchChoice<Account, ApplyView>(account, {
					TrialUnusedAccount: () => ({
						kind: "TrialAvailable",
						plans: encodePlans(),
						planNotice: TRIAL_AVAILABLE_MESSAGE,
					}),
					TrialUsedAccount: () => ({
						kind: "PaymentRequired",
						plans: encodePlans(),
						planNotice: PAYMENT_REQUIRED_MESSAGE,
					}),
				}),
			TrialSubscription: () => ({
				kind: "AlreadySubscribed",
				subscribedNotice: ALREADY_SUBSCRIBED_MESSAGE,
			}),
			PendingPaymentSubscription: () => ({
				kind: "AlreadySubscribed",
				subscribedNotice: ALREADY_SUBSCRIBED_MESSAGE,
			}),
			PaidSubscription: () => ({
				kind: "AlreadySubscribed",
				subscribedNotice: ALREADY_SUBSCRIBED_MESSAGE,
			}),
			UpgradePendingSubscription: () => ({
				kind: "AlreadySubscribed",
				subscribedNotice: ALREADY_SUBSCRIBED_MESSAGE,
			}),
			CancelReservedSubscription: () => ({
				kind: "AlreadySubscribed",
				subscribedNotice: ALREADY_SUBSCRIBED_MESSAGE,
			}),
			PlanChangeReservedSubscription: () => ({
				kind: "AlreadySubscribed",
				subscribedNotice: ALREADY_SUBSCRIBED_MESSAGE,
			}),
		}),
	/** 未ログインのとき。 */
	anonymous: {
		kind: "AnonymousApply",
		loginPrompt: LOGIN_REQUIRED_MESSAGE,
	} satisfies Extract<ApplyView, { kind: "AnonymousApply" }>,
	/** セッションや契約情報を読めなかったとき。 */
	unavailable: {
		kind: "ApplyUnavailable",
		alert: APPLY_VIEW_UNAVAILABLE_MESSAGE,
	} satisfies Extract<ApplyView, { kind: "ApplyUnavailable" }>,
};

const encodePlans = (): ApplyPlanView[] =>
	Plan.all().map((plan) => ({
		id: planIdValue(plan.id),
		name: PlanName.value(plan.name),
		monthlyPrice: MonthlyPrice.value(plan.monthlyPrice),
	}));

/** DTO に出す識別子。画面がプラン変更の要求に使うため、ドメインの判別子と同じ文字列にする。 */
const planIdValue = (planId: PlanId): string =>
	matchChoice<PlanId, string>(planId, {
		Basic: () => "Basic",
		Pro: () => "Pro",
	});

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type ApplyPlanView = {
	id: string;
	name: string;
	monthlyPrice: number;
};

/**
 * 申し込み画面が必要とする状態。状態ごとに、画面に出す値を持たせる。
 * ページは kind ではなく値の有無で描き分ける。
 */
export type ApplyView =
	/** 未ログイン。ログインを案内する。 */
	| Case<"AnonymousApply", { loginPrompt: string }>
	/** 契約情報を読めなかった。 */
	| Case<"ApplyUnavailable", { alert: string }>
	/** 契約中のため申し込めない。 */
	| Case<"AlreadySubscribed", { subscribedNotice: string }>
	/** 申し込むとトライアルが始まる。 */
	| Case<"TrialAvailable", { plans: ApplyPlanView[]; planNotice: string }>
	/** トライアル使用済みのため、申し込むと請求が立つ。 */
	| Case<"PaymentRequired", { plans: ApplyPlanView[]; planNotice: string }>;
