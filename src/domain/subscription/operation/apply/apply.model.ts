import type { Case } from "#/domain/building-blocks";
import {
	Account,
	type TrialUsedAccount,
} from "#/domain/subscription/model/account.entity";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import type { UnpaidInvoice } from "#/domain/subscription/model/invoice.entity";
import type {
	PlanId,
	PlanIdError,
} from "#/domain/subscription/model/plan.model";
import {
	type PendingPaymentSubscription,
	Subscription,
	type TrialSubscription,
} from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// 入力
// ===========================================================================

/** 信頼境界を越えてきた、まだドメインの型へ変換していない申し込み入力。 */
export type UnvalidatedApplyCommand = {
	accountId: string;
	planId: string;
};

/** ドメインの primitive へ変換済みの申し込み入力。 */
export type ValidatedApplyCommand = {
	accountId: AccountId;
	planId: PlanId;
};

/** ワークフローが読む現在の状態。境界層がポートで取得して渡す。 */
export type ApplyContext = {
	account: Account;
	subscription: Subscription;
};

/** 読み取り結果から申し込みの前提を組み立てる。行が無いものの扱いは各 entity が決める。 */
export const ApplyContext = {
	of: (
		found: { account: Account | null; subscription: Subscription | null },
		accountId: AccountId,
	): ApplyContext => ({
		account: Account.orTrialUnused(found.account, accountId),
		subscription: Subscription.orFree(found.subscription, accountId),
	}),
};

// ===========================================================================
// イベント
// ===========================================================================

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

// ===========================================================================
// エラー
// ===========================================================================

export type ApplyError = InvalidApplyCommand | AlreadySubscribed;

/** 入力値の形式が不正。 */
export type InvalidApplyCommand = Case<
	"InvalidApplyCommand",
	{ reason: ApplyCommandError }
>;
export type ApplyCommandError = PlanIdError;

/** 契約中のアカウントは申し込めない。FreeSubscription 以外はすべてこれ。 */
export type AlreadySubscribed = Case<"AlreadySubscribed">;
