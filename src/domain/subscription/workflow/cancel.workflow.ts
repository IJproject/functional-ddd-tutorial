import {
	err,
	matchChoice,
	ok,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	CancellationReserved,
	CancelTrialError,
	NotInTrial,
	NotPaid,
	PaymentPending,
	ReserveCancellationError,
	TrialCancelled,
} from "#/domain/subscription/model/cancel.model";
import type { Subscription } from "#/domain/subscription/model/subscription.model";

// ===========================================================================
// 型定義
// ===========================================================================

/** 現在の状態 → トライアル解約結果。純粋関数（I/O を含まない）。 */
export type CancelTrial = (
	subscription: Subscription,
) => ResultType<TrialCancelled, CancelTrialError>;

export type CancelTrialWorkflowDeps = {
	cancelTrial: CancelTrial;
};

export type CancelTrialWorkflow = CancelTrial;

export type CreateCancelTrialWorkflow = (
	deps: CancelTrialWorkflowDeps,
) => CancelTrialWorkflow;

/** 現在の状態 → 解約予約結果。純粋関数（I/O を含まない）。 */
export type ReserveCancellation = (
	subscription: Subscription,
) => ResultType<CancellationReserved, ReserveCancellationError>;

export type ReserveCancellationWorkflowDeps = {
	reserveCancellation: ReserveCancellation;
};

export type ReserveCancellationWorkflow = ReserveCancellation;

export type CreateReserveCancellationWorkflow = (
	deps: ReserveCancellationWorkflowDeps,
) => ReserveCancellationWorkflow;

// ===========================================================================
// 実装
// ===========================================================================

const notInTrial = (): ResultType<TrialCancelled, NotInTrial> =>
	err({ kind: "NotInTrial" });

export const cancelTrial: CancelTrial = (subscription) =>
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
export const reserveCancellation: ReserveCancellation = (subscription) =>
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

/** 純粋関数で I/O を含まないため AsyncResult ではなく Result を使う。 */
export const createCancelTrialWorkflow: CreateCancelTrialWorkflow =
	(deps) => (subscription) =>
		deps.cancelTrial(subscription);

/** 純粋関数で I/O を含まないため AsyncResult ではなく Result を使う。 */
export const createReserveCancellationWorkflow: CreateReserveCancellationWorkflow =
	(deps) => (subscription) =>
		deps.reserveCancellation(subscription);
