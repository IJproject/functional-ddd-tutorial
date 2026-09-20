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
	EndTrialError,
	NotInTrial,
	TrialEnded,
} from "#/domain/subscription/operation/schedule/schedule.model";

// ===========================================================================
// 型定義
// ===========================================================================

export type EndTrialWorkflow = (
	subscription: Subscription,
) => ResultType<TrialEnded, EndTrialError>;

export type EndTrialWorkflowDeps = {
	endTrial: EndTrial;
	newInvoiceId: () => InvoiceId;
	now: () => Date;
};
export type CreateEndTrialWorkflow = (
	deps: EndTrialWorkflowDeps,
) => EndTrialWorkflow;

/** 現在の状態 → トライアル終了結果。純粋関数（I/O を含まない）。 */
export type EndTrial = (
	subscription: Subscription,
	issued: { invoiceId: InvoiceId; now: Date },
) => ResultType<TrialEnded, EndTrialError>;

// ===========================================================================
// 実装
// ===========================================================================

const notInTrial = (): ResultType<TrialEnded, NotInTrial> =>
	err({ kind: "NotInTrial" });

export const endTrial: EndTrial = (subscription, issued) =>
	matchChoice<Subscription, ResultType<TrialEnded, EndTrialError>>(
		subscription,
		{
			FreeSubscription: notInTrial,
			TrialSubscription: (current) => {
				const plan = Plan.of(current.planId);
				return ok({
					kind: "TrialEnded",
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
						purpose: { kind: "New" },
						issuedAt: IssuedAt.create(issued.now),
					},
				});
			},
			PendingPaymentSubscription: notInTrial,
			PaidSubscription: notInTrial,
			UpgradePendingSubscription: notInTrial,
			CancelReservedSubscription: notInTrial,
			PlanChangeReservedSubscription: notInTrial,
		},
	);

/** 純粋関数で I/O を含まないため AsyncResult ではなく Result を使う。 */
export const createEndTrialWorkflow: CreateEndTrialWorkflow =
	(deps) => (subscription) =>
		deps.endTrial(subscription, {
			invoiceId: deps.newInvoiceId(),
			now: deps.now(),
		});
