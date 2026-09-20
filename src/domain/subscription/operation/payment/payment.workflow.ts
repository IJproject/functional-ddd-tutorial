import {
	type AsyncResult,
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
} from "#/domain/subscription/model/invoice.entity";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";
import { PeriodEndsAt } from "#/domain/subscription/model/subscription.primitive";
import type {
	InvoiceAlreadyProcessed,
	NoPendingPayment,
	PayInvoiceError,
	PaymentOutcome,
	PaymentSettled,
} from "#/domain/subscription/operation/payment/payment.model";

// ===========================================================================
// 型定義
// ===========================================================================

export type PayInvoiceWorkflow = (
	invoice: Invoice,
	subscription: Subscription,
	settled: { now: Date },
) => AsyncResult<PaymentSettled, PayInvoiceError>;

export type PayInvoiceWorkflowDeps = {
	chargeInvoice: ChargeInvoice;
	payInvoice: PayInvoice;
};
export type CreatePayInvoiceWorkflow = (
	deps: PayInvoiceWorkflowDeps,
) => PayInvoiceWorkflow;

/**
 * 未払いの請求 → 決済サービスの結果。I/O を伴うためドメインは型だけを定め、実装は外から注入する。
 * 決済サービスの失敗も正常な応答として扱うため、Failed は Result の err ではなく
 * PaymentOutcome の一方の枝として返す。
 */
export type ChargeInvoice = (invoice: UnpaidInvoice) => Promise<PaymentOutcome>;

/** 請求 + 現在の状態 + 決済結果 → 支払い反映結果。純粋関数（I/O を含まない）。 */
export type PayInvoice = (
	invoice: Invoice,
	subscription: Subscription,
	outcome: PaymentOutcome,
	settled: { now: Date },
) => ResultType<PaymentSettled, PayInvoiceError>;

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

/** 課金 I/O の後に、純粋な状態遷移へ決済結果を渡す。処理済みの請求には課金しない。 */
export const createPayInvoiceWorkflow: CreatePayInvoiceWorkflow =
	(deps) => (invoice, subscription, settled) =>
		matchChoice<Invoice, AsyncResult<PaymentSettled, PayInvoiceError>>(
			invoice,
			{
				UnpaidInvoice: async (unpaid) => {
					const outcome = await deps.chargeInvoice(unpaid);
					return deps.payInvoice(unpaid, subscription, outcome, settled);
				},
				PaidInvoice: async () =>
					err<InvoiceAlreadyProcessed>({ kind: "InvoiceAlreadyProcessed" }),
				FailedInvoice: async () =>
					err<InvoiceAlreadyProcessed>({ kind: "InvoiceAlreadyProcessed" }),
			},
		);
