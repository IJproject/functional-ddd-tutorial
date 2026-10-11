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

/** Account と Subscription → 申し込み画面専用の表示モデル。 */
export const ApplyContextView = {
	encode: (account: Account, subscription: Subscription): ApplyContextView =>
		matchChoice<Subscription, ApplyContextView>(subscription, {
			FreeSubscription: () =>
				matchChoice<Account, ApplyContextView>(account, {
					TrialUnusedAccount: () => ({
						kind: "TrialAvailable",
						plans: encodePlans(),
					}),
					TrialUsedAccount: () => ({
						kind: "PaymentRequired",
						plans: encodePlans(),
					}),
				}),
			TrialSubscription: () => ({ kind: "AlreadySubscribed" }),
			PendingPaymentSubscription: () => ({ kind: "AlreadySubscribed" }),
			PaidSubscription: () => ({ kind: "AlreadySubscribed" }),
			UpgradePendingSubscription: () => ({ kind: "AlreadySubscribed" }),
			CancelReservedSubscription: () => ({ kind: "AlreadySubscribed" }),
			PlanChangeReservedSubscription: () => ({ kind: "AlreadySubscribed" }),
		}),
};

const encodePlans = (): ApplyPlanView[] =>
	Plan.all().map((plan) => ({
		id: planIdValue(plan.id),
		name: PlanName.value(plan.name),
		monthlyPrice: MonthlyPrice.value(plan.monthlyPrice),
	}));

/** トライアル利用状況に応じた画面表示。日数を UI に重複させない。 */
export const TRIAL_AVAILABLE_MESSAGE = "14日間の無料トライアルが始まります";
export const PAYMENT_REQUIRED_MESSAGE = "請求が作成されます";
export const APPLY_CONTEXT_UNAVAILABLE_MESSAGE =
	"契約情報を読み込めませんでした";
export const APPLY_LOGIN_REQUIRED_MESSAGE = "ログインしてください。";
export const ALREADY_SUBSCRIBED_APPLY_MESSAGE =
	"すでに契約中のため申し込みできません。";

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

/** 申し込み画面が必要とする状態。申し込めるかとトライアルの有無を case で表す。 */
export type ApplyContextView =
	| Case<"AnonymousApplyContext">
	| Case<"ApplyContextUnavailable">
	/** 契約中のため申し込めない。 */
	| Case<"AlreadySubscribed">
	/** 申し込むとトライアルが始まる。 */
	| Case<"TrialAvailable", { plans: ApplyPlanView[] }>
	/** トライアル使用済みのため、申し込むと請求が立つ。 */
	| Case<"PaymentRequired", { plans: ApplyPlanView[] }>;
