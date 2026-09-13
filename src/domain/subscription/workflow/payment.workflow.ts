import {
	err,
	matchChoice,
	ok,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	FailedInvoice,
	Invoice,
	PaidInvoice,
	UnpaidInvoice,
} from "#/domain/subscription/model/invoice.model";
import type {
	InvoiceAlreadyProcessed,
	NoPendingPayment,
	PayInvoiceError,
	PaymentOutcome,
	PaymentSettled,
} from "#/domain/subscription/model/payment.model";
import type { Subscription } from "#/domain/subscription/model/subscription.model";
import { PeriodEndsAt } from "#/domain/subscription/model/subscription.primitive";

// ===========================================================================
// 型定義
// ===========================================================================

/** 請求 + 現在の状態 + 決済結果 → 支払い反映結果。純粋関数（I/O を含まない）。 */
export type PayInvoice = (
	invoice: Invoice,
	subscription: Subscription,
	outcome: PaymentOutcome,
	settled: { now: Date },
) => ResultType<PaymentSettled, PayInvoiceError>;

export type PayInvoiceWorkflowDeps = {
	payInvoice: PayInvoice;
};

export type PayInvoiceWorkflow = PayInvoice;

export type CreatePayInvoiceWorkflow = (
	deps: PayInvoiceWorkflowDeps,
) => PayInvoiceWorkflow;

// ===========================================================================
// 実装
// ===========================================================================

const paidInvoice = (invoice: UnpaidInvoice): PaidInvoice => ({
	kind: "PaidInvoice",
	id: invoice.id,
	accountId: invoice.accountId,
	planId: invoice.planId,
	amount: invoice.amount,
	purpose: invoice.purpose,
	issuedAt: invoice.issuedAt,
});

const failedInvoice = (invoice: UnpaidInvoice): FailedInvoice => ({
	kind: "FailedInvoice",
	id: invoice.id,
	accountId: invoice.accountId,
	planId: invoice.planId,
	amount: invoice.amount,
	purpose: invoice.purpose,
	issuedAt: invoice.issuedAt,
});

const noPendingPayment = (): ResultType<PaymentSettled, NoPendingPayment> =>
	err({ kind: "NoPendingPayment" });

const settlePayment = (
	invoice: UnpaidInvoice,
	subscription: Subscription,
	outcome: PaymentOutcome,
	settled: { now: Date },
): ResultType<PaymentSettled, NoPendingPayment> =>
	matchChoice<Subscription, ResultType<PaymentSettled, NoPendingPayment>>(
		subscription,
		{
			FreeSubscription: noPendingPayment,
			TrialSubscription: noPendingPayment,
			PendingPaymentSubscription: (current) =>
				matchChoice<
					PaymentOutcome,
					ResultType<PaymentSettled, NoPendingPayment>
				>(outcome, {
					Succeeded: () => {
						// 引数の now を破壊せず、複製した Date だけを1か月後へ進める。
						const nextMonth = new Date(settled.now.getTime());
						nextMonth.setMonth(nextMonth.getMonth() + 1);
						return ok({
							kind: "PaymentSettled",
							subscription: {
								kind: "PaidSubscription",
								accountId: current.accountId,
								planId: invoice.planId,
								periodEndsAt: PeriodEndsAt.create(nextMonth),
							},
							invoice: paidInvoice(invoice),
						});
					},
					Failed: () =>
						ok({
							kind: "PaymentSettled",
							subscription: {
								kind: "FreeSubscription",
								accountId: current.accountId,
							},
							invoice: failedInvoice(invoice),
						}),
				}),
			PaidSubscription: noPendingPayment,
			UpgradePendingSubscription: (current) =>
				matchChoice<
					PaymentOutcome,
					ResultType<PaymentSettled, NoPendingPayment>
				>(outcome, {
					Succeeded: () =>
						ok({
							kind: "PaymentSettled",
							subscription: {
								kind: "PaidSubscription",
								accountId: current.accountId,
								planId: invoice.planId,
								periodEndsAt: current.periodEndsAt,
							},
							invoice: paidInvoice(invoice),
						}),
					Failed: () =>
						ok({
							kind: "PaymentSettled",
							subscription: {
								kind: "PaidSubscription",
								accountId: current.accountId,
								planId: current.planId,
								periodEndsAt: current.periodEndsAt,
							},
							invoice: failedInvoice(invoice),
						}),
				}),
			CancelReservedSubscription: noPendingPayment,
			PlanChangeReservedSubscription: noPendingPayment,
		},
	);

export const payInvoice: PayInvoice = (
	invoice,
	subscription,
	outcome,
	settled,
) =>
	matchChoice<Invoice, ResultType<PaymentSettled, PayInvoiceError>>(invoice, {
		UnpaidInvoice: (unpaid) =>
			settlePayment(unpaid, subscription, outcome, settled),
		PaidInvoice: () =>
			err<InvoiceAlreadyProcessed>({ kind: "InvoiceAlreadyProcessed" }),
		FailedInvoice: () =>
			err<InvoiceAlreadyProcessed>({ kind: "InvoiceAlreadyProcessed" }),
	});

/** 純粋関数で I/O を含まないため AsyncResult ではなく Result を使う。 */
export const createPayInvoiceWorkflow: CreatePayInvoiceWorkflow =
	(deps) => (invoice, subscription, outcome, settled) =>
		deps.payInvoice(invoice, subscription, outcome, settled);
