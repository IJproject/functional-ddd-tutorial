import {
	err,
	matchChoice,
	ok,
	pipe,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	ChangePlanError,
	ChangePlanRequest,
	NotSubscribed,
	PaymentPending,
	PlanChanged,
	PlanChangeNotAllowed,
	ReservationExists,
	UnknownPlan,
	UnvalidatedChangePlanRequest,
} from "#/domain/subscription/model/change-plan.model";
import type { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import {
	Amount,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Plan } from "#/domain/subscription/model/plan.model";
import {
	MonthlyPrice,
	PlanId,
} from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.model";

// ===========================================================================
// 型定義
// ===========================================================================

/** ① 未検証 → ② 検証済み。純粋関数。 */
export type ValidateChangePlanRequest = (
	request: UnvalidatedChangePlanRequest,
) => ResultType<ChangePlanRequest, UnknownPlan>;

/** ② 検証済み + 現在の状態 → ③ プラン変更結果。純粋関数（I/O を含まない）。 */
export type ChangePlanForSubscription = (
	request: ChangePlanRequest,
	subscription: Subscription,
	issued: { invoiceId: InvoiceId; now: Date },
) => ResultType<PlanChanged, Exclude<ChangePlanError, UnknownPlan>>;

export type ChangePlanWorkflowDeps = {
	validateChangePlanRequest: ValidateChangePlanRequest;
	changePlanForSubscription: ChangePlanForSubscription;
	newInvoiceId: () => InvoiceId;
	now: () => Date;
};

export type ChangePlanWorkflow = (
	request: UnvalidatedChangePlanRequest,
	subscription: Subscription,
) => ResultType<PlanChanged, ChangePlanError>;

export type CreateChangePlanWorkflow = (
	deps: ChangePlanWorkflowDeps,
) => ChangePlanWorkflow;

// ===========================================================================
// 実装
// ===========================================================================

const PLAN_IDS: Readonly<Record<string, PlanId | undefined>> = {
	Basic: PlanId.create("Basic"),
	Pro: PlanId.create("Pro"),
};

export const validateChangePlanRequest: ValidateChangePlanRequest = (
	request,
) => {
	const planId = PLAN_IDS[request.planId];
	return planId ? ok({ planId }) : err({ kind: "UnknownPlan" });
};

const samePlan = (current: PlanId, requested: PlanId): boolean =>
	PlanId.value(current) === PlanId.value(requested);

const planChangeNotAllowed = (): ResultType<
	PlanChanged,
	PlanChangeNotAllowed
> => err({ kind: "PlanChangeNotAllowed" });

export const changePlanForSubscription: ChangePlanForSubscription = (
	request,
	subscription,
	issued,
) =>
	matchChoice<
		Subscription,
		ResultType<PlanChanged, Exclude<ChangePlanError, UnknownPlan>>
	>(subscription, {
		FreeSubscription: () => err<NotSubscribed>({ kind: "NotSubscribed" }),
		TrialSubscription: (current) => {
			if (samePlan(current.planId, request.planId)) {
				return planChangeNotAllowed();
			}
			const plan = Plan.of(request.planId);
			return ok({
				kind: "PaymentRequested",
				subscription: {
					kind: "PendingPaymentSubscription",
					accountId: current.accountId,
					planId: request.planId,
					pendingInvoiceId: issued.invoiceId,
				},
				invoice: {
					kind: "UnpaidInvoice",
					id: issued.invoiceId,
					accountId: current.accountId,
					planId: request.planId,
					amount: Amount.create(MonthlyPrice.value(plan.monthlyPrice)),
					purpose: { kind: "New" },
					issuedAt: IssuedAt.create(issued.now),
				},
			});
		},
		PendingPaymentSubscription: (current) =>
			samePlan(current.planId, request.planId)
				? planChangeNotAllowed()
				: err<PlanChangeNotAllowed>({ kind: "PlanChangeNotAllowed" }),
		PaidSubscription: (current) => {
			if (samePlan(current.planId, request.planId)) {
				return planChangeNotAllowed();
			}
			const difference = Plan.priceDifference(current.planId, request.planId);
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
							planId: request.planId,
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
							nextPlanId: request.planId,
						},
					});
		},
		UpgradePendingSubscription: (current) =>
			samePlan(current.planId, request.planId)
				? planChangeNotAllowed()
				: err<PaymentPending>({ kind: "PaymentPending" }),
		CancelReservedSubscription: (current) =>
			samePlan(current.planId, request.planId)
				? planChangeNotAllowed()
				: err<ReservationExists>({ kind: "ReservationExists" }),
		PlanChangeReservedSubscription: (current) =>
			samePlan(current.planId, request.planId)
				? planChangeNotAllowed()
				: err<ReservationExists>({ kind: "ReservationExists" }),
	});

/**
 * 全段が純粋関数で I/O を含まないため AsyncResult ではなく Result を使う。
 * 検証が成功したときだけ状態遷移へ進むよう、pipe と Result.flatMap で連結する。
 */
export const createChangePlanWorkflow: CreateChangePlanWorkflow =
	(deps) => (request, subscription) =>
		pipe(
			deps.validateChangePlanRequest(request),
			Result.flatMap((validated) =>
				deps.changePlanForSubscription(validated, subscription, {
					invoiceId: deps.newInvoiceId(),
					now: deps.now(),
				}),
			),
		);
