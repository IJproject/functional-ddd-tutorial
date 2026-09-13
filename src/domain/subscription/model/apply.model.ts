import type { Case } from "#/domain/building-blocks";
import type {
	Account,
	TrialUsedAccount,
} from "#/domain/subscription/model/account.model";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import type { UnpaidInvoice } from "#/domain/subscription/model/invoice.model";
import type { PlanId } from "#/domain/subscription/model/plan.primitive";
import type {
	PendingPaymentSubscription,
	Subscription,
	TrialSubscription,
} from "#/domain/subscription/model/subscription.model";

// ===========================================================================
// 型定義
// ===========================================================================

/** 信頼境界を越えてきた、まだドメインの型へ変換していない申し込み入力。 */
export type UnvalidatedApplyRequest = {
	accountId: string;
	planId: string;
};

/** ドメインの primitive へ変換済みの申し込み入力。 */
export type ApplyRequest = {
	accountId: AccountId;
	planId: PlanId;
};

/** ワークフローが読む現在の状態。境界層がポートで取得して渡す。 */
export type ApplyContext = {
	account: Account;
	subscription: Subscription;
};

/**
 * 申し込みの結果。トライアル未使用なら試用開始、使用済みなら請求発行と、
 * 到達する状態が異なるので Case で分ける。
 */
export type Applied = TrialStarted | PaymentRequested;

export type TrialStarted = Case<
	"TrialStarted",
	{ account: TrialUsedAccount; subscription: TrialSubscription }
>;

export type PaymentRequested = Case<
	"PaymentRequested",
	{ subscription: PendingPaymentSubscription; invoice: UnpaidInvoice }
>;

export type ApplyError = InvalidApplyRequest | AlreadySubscribed;

/** 入力値の形式が不正。 */
export type InvalidApplyRequest = Case<
	"InvalidApplyRequest",
	{ reason: ApplyRequestError }
>;
export type ApplyRequestError = Case<"UnknownPlan">;

/** 契約中のアカウントは申し込めない。FreeSubscription 以外はすべてこれ。 */
export type AlreadySubscribed = Case<"AlreadySubscribed">;
