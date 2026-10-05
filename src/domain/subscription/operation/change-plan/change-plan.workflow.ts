import {
	err,
	matchChoice,
	ok,
	pipe,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import {
	Amount,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Plan } from "#/domain/subscription/model/plan.entity";
import {
	MonthlyPrice,
	PlanId,
} from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";
import type {
	ChangePlanError,
	NotSubscribed,
	PaymentPending,
	PlanChanged,
	PlanChangeNotAllowed,
	ReservationExists,
	UnknownPlan,
	UnvalidatedChangePlanCommand,
	ValidatedChangePlanCommand,
} from "#/domain/subscription/operation/change-plan/change-plan.model";

// ===========================================================================
// 型定義
// ===========================================================================

export type ChangePlanWorkflow = (
	command: UnvalidatedChangePlanCommand,
	subscription: Subscription,
) => ResultType<PlanChanged, ChangePlanError>;

export type ChangePlanWorkflowDeps = {
	newInvoiceId: () => InvoiceId;
	now: () => Date;
};
export type CreateChangePlanWorkflow = (
	deps: ChangePlanWorkflowDeps,
) => ChangePlanWorkflow;

/** ① 未検証 → ② 検証済み。純粋関数。 */
export type ValidateChangePlanCommand = (
	command: UnvalidatedChangePlanCommand,
) => ResultType<ValidatedChangePlanCommand, UnknownPlan>;

/** ② 検証済み + 現在の状態 → ③ プラン変更結果。純粋関数（I/O を含まない）。 */
export type ChangePlanForSubscription = (
	command: ValidatedChangePlanCommand,
	subscription: Subscription,
	issued: { invoiceId: InvoiceId; now: Date },
) => ResultType<PlanChanged, Exclude<ChangePlanError, UnknownPlan>>;

// ===========================================================================
// 実装
// ===========================================================================

const PLAN_IDS: Readonly<Record<string, PlanId | undefined>> = {
	Basic: PlanId.create("Basic"),
	Pro: PlanId.create("Pro"),
};

export const validateChangePlanCommand: ValidateChangePlanCommand = (
	command,
) => {
	const planId = PLAN_IDS[command.planId];
	return planId ? ok({ planId }) : err({ kind: "UnknownPlan" });
};

const samePlan = (current: PlanId, requested: PlanId): boolean =>
	PlanId.value(current) === PlanId.value(requested);

const planChangeNotAllowed = (): ResultType<
	PlanChanged,
	PlanChangeNotAllowed
> => err({ kind: "PlanChangeNotAllowed" });

export const changePlanForSubscription: ChangePlanForSubscription = (
	command,
	subscription,
	issued,
) =>
	matchChoice<
		Subscription,
		ResultType<PlanChanged, Exclude<ChangePlanError, UnknownPlan>>
	>(subscription, {
		FreeSubscription: () => err<NotSubscribed>({ kind: "NotSubscribed" }),
		TrialSubscription: (current) => {
			if (samePlan(current.planId, command.planId)) {
				return planChangeNotAllowed();
			}
			const plan = Plan.of(command.planId);
			return ok({
				kind: "PaymentRequested",
				subscription: {
					kind: "PendingPaymentSubscription",
					accountId: current.accountId,
					planId: command.planId,
					pendingInvoiceId: issued.invoiceId,
				},
				invoice: {
					kind: "UnpaidInvoice",
					id: issued.invoiceId,
					accountId: current.accountId,
					planId: command.planId,
					amount: Amount.create(MonthlyPrice.value(plan.monthlyPrice)),
					purpose: { kind: "New" },
					issuedAt: IssuedAt.create(issued.now),
				},
			});
		},
		PendingPaymentSubscription: (current) =>
			samePlan(current.planId, command.planId)
				? planChangeNotAllowed()
				: err<PlanChangeNotAllowed>({ kind: "PlanChangeNotAllowed" }),
		PaidSubscription: (current) => {
			if (samePlan(current.planId, command.planId)) {
				return planChangeNotAllowed();
			}
			const difference = Plan.priceDifference(current.planId, command.planId);
			return difference > 0
				? ok({
						kind: "UpgradeRequested",
						subscription: {
							kind: "UpgradePendingSubscription",
							accountId: current.accountId,
							planId: current.planId,
							periodEndsAt: current.periodEndsAt,
							pendingInvoiceId: issued.invoiceId,
						},
						invoice: {
							kind: "UnpaidInvoice",
							id: issued.invoiceId,
							accountId: current.accountId,
							planId: command.planId,
							amount: Amount.create(difference),
							purpose: { kind: "UpgradeDifference" },
							issuedAt: IssuedAt.create(issued.now),
						},
					})
				: ok({
						kind: "PlanChangeReserved",
						subscription: {
							kind: "PlanChangeReservedSubscription",
							accountId: current.accountId,
							planId: current.planId,
							periodEndsAt: current.periodEndsAt,
							nextPlanId: command.planId,
						},
					});
		},
		UpgradePendingSubscription: (current) =>
			samePlan(current.planId, command.planId)
				? planChangeNotAllowed()
				: err<PaymentPending>({ kind: "PaymentPending" }),
		CancelReservedSubscription: (current) =>
			samePlan(current.planId, command.planId)
				? planChangeNotAllowed()
				: err<ReservationExists>({ kind: "ReservationExists" }),
		PlanChangeReservedSubscription: (current) =>
			samePlan(current.planId, command.planId)
				? planChangeNotAllowed()
				: err<ReservationExists>({ kind: "ReservationExists" }),
	});

/**
 * 全段が純粋関数で I/O を含まないため AsyncResult ではなく Result を使う。
 * 検証が成功したときだけ状態遷移へ進むよう、pipe と Result.flatMap で連結する。
 */
export const createChangePlanWorkflow: CreateChangePlanWorkflow =
	(deps) => (command, subscription) =>
		pipe(
			validateChangePlanCommand(command),
			Result.flatMap((validated) =>
				changePlanForSubscription(validated, subscription, {
					invoiceId: deps.newInvoiceId(),
					now: deps.now(),
				}),
			),
		);
