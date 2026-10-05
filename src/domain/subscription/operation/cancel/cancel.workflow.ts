import {
	err,
	matchChoice,
	ok,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";
import type {
	CancellationReserved,
	CancelTrialError,
	NotInTrial,
	NotPaid,
	PaymentPending,
	ReserveCancellationError,
	TrialCancelled,
} from "#/domain/subscription/operation/cancel/cancel.model";

// ===========================================================================
// 型定義
// ===========================================================================

/** 現在の状態 → トライアル解約結果。純粋関数で I/O を含まないため Result を返す。 */
export type CancelTrialWorkflow = (
	subscription: Subscription,
) => ResultType<TrialCancelled, CancelTrialError>;

/** 現在の状態 → 解約予約結果。純粋関数で I/O を含まないため Result を返す。 */
export type ReserveCancellationWorkflow = (
	subscription: Subscription,
) => ResultType<CancellationReserved, ReserveCancellationError>;

// ===========================================================================
// 実装
// ===========================================================================

const notInTrial = (): ResultType<TrialCancelled, NotInTrial> =>
	err({ kind: "NotInTrial" });

export const cancelTrialWorkflow: CancelTrialWorkflow = (subscription) =>
	matchChoice<Subscription, ResultType<TrialCancelled, CancelTrialError>>(
		subscription,
		{
			FreeSubscription: notInTrial,
			TrialSubscription: (current) =>
				ok({
					kind: "TrialCancelled",
					subscription: {
						kind: "FreeSubscription",
						accountId: current.accountId,
					},
				}),
			PendingPaymentSubscription: notInTrial,
			PaidSubscription: notInTrial,
			UpgradePendingSubscription: notInTrial,
			CancelReservedSubscription: notInTrial,
			PlanChangeReservedSubscription: notInTrial,
		},
	);

const notPaid = (): ResultType<CancellationReserved, NotPaid> =>
	err({ kind: "NotPaid" });

/**
 * UpgradePendingSubscription は未払いの差額請求 ID を持つ一方、
 * 「アップグレード支払い待ちかつ解約予約中」を表す Case がないため失敗させる。
 */
export const reserveCancellationWorkflow: ReserveCancellationWorkflow = (
	subscription,
) =>
	matchChoice<
		Subscription,
		ResultType<CancellationReserved, ReserveCancellationError>
	>(subscription, {
		FreeSubscription: notPaid,
		TrialSubscription: notPaid,
		PendingPaymentSubscription: notPaid,
		PaidSubscription: (current) =>
			ok({
				kind: "CancellationReserved",
				subscription: {
					kind: "CancelReservedSubscription",
					accountId: current.accountId,
					planId: current.planId,
					periodEndsAt: current.periodEndsAt,
				},
			}),
		UpgradePendingSubscription: () =>
			err<PaymentPending>({ kind: "PaymentPending" }),
		CancelReservedSubscription: notPaid,
		// 現行挙動を維持し、既存のプラン変更予約を解約予約で上書きする。
		PlanChangeReservedSubscription: (current) =>
			ok({
				kind: "CancellationReserved",
				subscription: {
					kind: "CancelReservedSubscription",
					accountId: current.accountId,
					planId: current.planId,
					periodEndsAt: current.periodEndsAt,
				},
			}),
	});
