import {
	err,
	matchChoice,
	ok,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import {
	Amount,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Plan } from "#/domain/subscription/model/plan.entity";
import { MonthlyPrice } from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";
import type {
	EndPeriodError,
	NotPaid,
	PaymentPending,
	PeriodEnded,
} from "#/domain/subscription/operation/schedule/schedule.model";

// ===========================================================================
// 型定義
// ===========================================================================

export type EndPeriodWorkflow = (
	subscription: Subscription,
) => ResultType<PeriodEnded, EndPeriodError>;

export type EndPeriodWorkflowDeps = {
	endPeriod: EndPeriod;
	newInvoiceId: () => InvoiceId;
	now: () => Date;
};
export type CreateEndPeriodWorkflow = (
	deps: EndPeriodWorkflowDeps,
) => EndPeriodWorkflow;

/** 現在の状態 → 期間満了結果。純粋関数（I/O を含まない）。 */
export type EndPeriod = (
	subscription: Subscription,
	issued: { invoiceId: InvoiceId; now: Date },
) => ResultType<PeriodEnded, EndPeriodError>;

// ===========================================================================
// 実装
// ===========================================================================

const notPaid = (): ResultType<PeriodEnded, NotPaid> =>
	err({ kind: "NotPaid" });

/**
 * UpgradePendingSubscription の pendingInvoiceId は未払いの差額請求を指す。
 * 期間満了で更新請求を作るとその ID を上書きするため、支払い完了までは失敗させる。
 */
export const endPeriod: EndPeriod = (subscription, issued) =>
	matchChoice<Subscription, ResultType<PeriodEnded, EndPeriodError>>(
		subscription,
		{
			FreeSubscription: notPaid,
			TrialSubscription: notPaid,
			PendingPaymentSubscription: notPaid,
			PaidSubscription: (current) => {
				const plan = Plan.of(current.planId);
				return ok({
					kind: "RenewalRequested",
					subscription: {
						kind: "PendingPaymentSubscription",
						accountId: current.accountId,
						planId: current.planId,
						pendingInvoiceId: issued.invoiceId,
					},
					invoice: {
						kind: "UnpaidInvoice",
						id: issued.invoiceId,
						accountId: current.accountId,
						planId: current.planId,
						amount: Amount.create(MonthlyPrice.value(plan.monthlyPrice)),
						purpose: { kind: "Renewal" },
						issuedAt: IssuedAt.create(issued.now),
					},
				});
			},
			UpgradePendingSubscription: () =>
				err<PaymentPending>({ kind: "PaymentPending" }),
			CancelReservedSubscription: (current) =>
				ok({
					kind: "SubscriptionEnded",
					subscription: {
						kind: "FreeSubscription",
						accountId: current.accountId,
					},
				}),
			PlanChangeReservedSubscription: (current) => {
				const nextPlan = Plan.of(current.nextPlanId);
				return ok({
					kind: "RenewalRequested",
					subscription: {
						kind: "PendingPaymentSubscription",
						accountId: current.accountId,
						planId: current.nextPlanId,
						pendingInvoiceId: issued.invoiceId,
					},
					invoice: {
						kind: "UnpaidInvoice",
						id: issued.invoiceId,
						accountId: current.accountId,
						planId: current.nextPlanId,
						amount: Amount.create(MonthlyPrice.value(nextPlan.monthlyPrice)),
						purpose: { kind: "Renewal" },
						issuedAt: IssuedAt.create(issued.now),
					},
				});
			},
		},
	);

/** 純粋関数で I/O を含まないため AsyncResult ではなく Result を使う。 */
export const createEndPeriodWorkflow: CreateEndPeriodWorkflow =
	(deps) => (subscription) =>
		deps.endPeriod(subscription, {
			invoiceId: deps.newInvoiceId(),
			now: deps.now(),
		});
