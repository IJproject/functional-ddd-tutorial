import * as z from "zod";
import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { Account } from "#/domain/subscription/model/account.model";
import type {
	Applied,
	ApplyError,
	UnvalidatedApplyRequest,
} from "#/domain/subscription/model/apply.model";
import { Plan } from "#/domain/subscription/model/plan.model";
import {
	MonthlyPrice,
	PlanId,
} from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.model";

// ===========================================================================
// 型定義
// ===========================================================================

/** 境界（JSON）での parse。プランとして妥当かはドメインの仕事。 */
export const applyCommandSchema = z.object({ planId: z.string() });
export type ApplyCommand = z.infer<typeof applyCommandSchema>;

export type PlanView = {
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
			plans: PlanView[];
	  };

export type ApplyResponse =
	| { ok: true }
	| { ok: false; errors: ApplyFieldError[] };

export type ApplyFieldError = { field: "planId" | null; message: string };

// ===========================================================================
// 実装
// ===========================================================================

const ALREADY_SUBSCRIBED_MESSAGE = "すでに契約中です";
const UNKNOWN_PLAN_MESSAGE = "有料プランを選択してください";

/** トライアル利用状況に応じた画面表示。日数を UI に重複させない。 */
export const TRIAL_AVAILABLE_MESSAGE = "14日間の無料トライアルが始まります";
export const PAYMENT_REQUIRED_MESSAGE = "請求が作成されます";

const planName = (planId: PlanId): string =>
	matchChoice<{ kind: "Basic" } | { kind: "Pro" }, string>(
		{ kind: PlanId.value(planId) },
		{
			Basic: () => "ベーシック",
			Pro: () => "プロ",
		},
	);

/** ドメインのエラーを、表示対象の項目と文言へ網羅的に翻訳する。 */
const toFieldError = (error: ApplyError): ApplyFieldError =>
	matchChoice(error, {
		InvalidApplyRequest: ({ reason }) =>
			matchChoice(reason, {
				UnknownPlan: () => ({
					field: "planId" as const,
					message: UNKNOWN_PLAN_MESSAGE,
				}),
			}),
		AlreadySubscribed: () => ({
			field: null,
			message: ALREADY_SUBSCRIBED_MESSAGE,
		}),
	});

/** ApplyCommand と認証済みアカウント ID → ドメインの未検証入力。 */
export const decodeApplyCommand = (
	command: ApplyCommand,
	accountId: string,
): UnvalidatedApplyRequest => ({
	accountId,
	planId: command.planId,
});

/** ドメインの結果 → ApplyResponse。 */
export const encodeApplyResponse = (
	result: ResultType<Applied, ApplyError>,
): ApplyResponse =>
	Result.match<Applied, ApplyError, ApplyResponse>(result, {
		ok: () => ({ ok: true }),
		err: (error) => ({ ok: false, errors: [toFieldError(error)] }),
	});

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
