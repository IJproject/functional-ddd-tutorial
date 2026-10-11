import {
	AsyncResult,
	err,
	matchChoice,
	ok,
	pipe,
	type Result as ResultType,
} from "#/domain/building-blocks";
import {
	billedPlanId,
	type FailedInvoice,
	type Invoice,
	type PaidInvoice,
	type UnpaidInvoice,
} from "#/domain/subscription/model/invoice.entity";
import {
	InvoiceId,
	type PaidAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import { billingPeriodEnd } from "#/domain/subscription/model/subscription.primitive";
import type {
	AwaitingPaymentSubscription,
	Payable,
	PayInvoiceError,
	PaymentGatewayError,
	PaymentOutcome,
	PaymentSettled,
} from "#/domain/subscription/operation/payment/payment.model";

// ===========================================================================
// 型定義
// ===========================================================================

/**
 * 読み取った請求（無ければ null）と契約 → 支払いの結果。
 * 請求が無いことの意味（InvoiceNotFound）はワークフローが決める。
 */
export type PayInvoiceWorkflow = (
	invoice: Invoice | null,
	subscription: Subscription,
) => AsyncResult<PaymentSettled, PayInvoiceError | PaymentGatewayError>;

export type PayInvoiceWorkflowDeps = {
	chargeInvoice: ChargeInvoice;
	paidAt: () => PaidAt;
};
export type CreatePayInvoiceWorkflow = (
	deps: PayInvoiceWorkflowDeps,
) => PayInvoiceWorkflow;

/** ① 読み取った請求と契約 → 支払える組。課金の前にすべての判定を済ませる。純粋関数。 */
export type AsPayable = (
	invoice: Invoice | null,
	subscription: Subscription,
) => ResultType<Payable, PayInvoiceError>;

/**
 * ② 未払いの請求 → 決済サービスの結果。I/O を伴うためドメインは型だけを定め、実装は外から注入する。
 * 決済サービスの失敗も正常な応答として扱うため、Failed は Result の err ではなく
 * PaymentOutcome の一方の枝として返す。
 */
export type ChargeInvoice = (
	invoice: UnpaidInvoice,
) => AsyncResult<PaymentOutcome, PaymentGatewayError>;

/** ③ 支払える組 + 決済結果 → 支払いの結果。判定は ① で済んでいるので失敗しない。純粋関数。 */
export type SettlePayment = (
	payable: Payable,
	outcome: PaymentOutcome,
	paidAt: PaidAt,
) => PaymentSettled;

// ===========================================================================
// 実装
// ===========================================================================

const paidInvoice = (invoice: UnpaidInvoice, paidAt: PaidAt): PaidInvoice => ({
	kind: "PaidInvoice",
	id: invoice.id,
	accountId: invoice.accountId,
	amount: invoice.amount,
	purpose: invoice.purpose,
	issuedAt: invoice.issuedAt,
	paidAt,
});

const failedInvoice = (invoice: UnpaidInvoice): FailedInvoice => ({
	kind: "FailedInvoice",
	id: invoice.id,
	accountId: invoice.accountId,
	amount: invoice.amount,
	purpose: invoice.purpose,
	issuedAt: invoice.issuedAt,
});

export const asPayable: AsPayable = (invoice, subscription) => {
	if (invoice === null) return err({ kind: "InvoiceNotFound" });
	return matchChoice<Invoice, ResultType<Payable, PayInvoiceError>>(invoice, {
		PaidInvoice: () => err({ kind: "InvoiceAlreadyProcessed" }),
		FailedInvoice: () => err({ kind: "InvoiceAlreadyProcessed" }),
		UnpaidInvoice: (unpaid) =>
			matchChoice<Subscription, ResultType<Payable, PayInvoiceError>>(
				subscription,
				{
					FreeSubscription: () => err({ kind: "NoPendingPayment" }),
					TrialSubscription: () => err({ kind: "NoPendingPayment" }),
					PendingPaymentSubscription: (current) =>
						InvoiceId.value(current.pendingInvoiceId) ===
						InvoiceId.value(unpaid.id)
							? ok({ invoice: unpaid, subscription: current })
							: err({ kind: "NotPendingInvoice" }),
					PaidSubscription: () => err({ kind: "NoPendingPayment" }),
					UpgradePendingSubscription: (current) =>
						InvoiceId.value(current.pendingInvoiceId) ===
						InvoiceId.value(unpaid.id)
							? ok({ invoice: unpaid, subscription: current })
							: err({ kind: "NotPendingInvoice" }),
					CancelReservedSubscription: () => err({ kind: "NoPendingPayment" }),
					PlanChangeReservedSubscription: () =>
						err({ kind: "NoPendingPayment" }),
				},
			),
	});
};

export const settlePayment: SettlePayment = (payable, outcome, paidAt) => {
	const { invoice } = payable;
	return matchChoice<AwaitingPaymentSubscription, PaymentSettled>(
		payable.subscription,
		{
			PendingPaymentSubscription: (current) =>
				matchChoice<PaymentOutcome, PaymentSettled>(outcome, {
					Succeeded: () => ({
						kind: "PaymentSucceeded",
						subscription: Subscription.paid({
							accountId: current.accountId,
							planId: billedPlanId(invoice.purpose),
							periodEndsAt: billingPeriodEnd(paidAt),
						}),
						invoice: paidInvoice(invoice, paidAt),
					}),
					Failed: () => ({
						kind: "PaymentFailed",
						subscription: Subscription.free(current.accountId),
						invoice: failedInvoice(invoice),
					}),
				}),
			UpgradePendingSubscription: (current) =>
				matchChoice<PaymentOutcome, PaymentSettled>(outcome, {
					Succeeded: () => ({
						kind: "PaymentSucceeded",
						subscription: Subscription.paid({
							accountId: current.accountId,
							planId: billedPlanId(invoice.purpose),
							periodEndsAt: current.periodEndsAt,
						}),
						invoice: paidInvoice(invoice, paidAt),
					}),
					Failed: () => ({
						kind: "PaymentFailed",
						subscription: Subscription.paid({
							accountId: current.accountId,
							planId: current.planId,
							periodEndsAt: current.periodEndsAt,
						}),
						invoice: failedInvoice(invoice),
					}),
				}),
		},
	);
};

/**
 * 判定 → 課金 → 遷移。判定を課金の前に済ませるので、
 * 支払えない組み合わせでは決済サービスを呼ばない。
 */
export const createPayInvoiceWorkflow: CreatePayInvoiceWorkflow =
	(deps) => (invoice, subscription) =>
		pipe(
			asPayable(invoice, subscription),
			AsyncResult.flatMap((payable) =>
				pipe(
					deps.chargeInvoice(payable.invoice),
					AsyncResult.map((outcome) =>
						settlePayment(payable, outcome, deps.paidAt()),
					),
				),
			),
		);
