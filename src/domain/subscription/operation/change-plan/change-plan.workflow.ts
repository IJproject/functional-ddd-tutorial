import {
	err,
	matchChoice,
	ok,
	pipe,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import { Invoice } from "#/domain/subscription/model/invoice.entity";
import type {
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Plan, type PlanChange } from "#/domain/subscription/model/plan.entity";
import {
	PlanId,
	type PlanId as PlanIdType,
} from "#/domain/subscription/model/plan.model";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import type {
	ChangePlanError,
	NotSubscribed,
	PaymentPending,
	PlanChanged,
	ReservationExists,
	SamePlan,
	UnvalidatedChangePlanCommand,
	ValidatedChangePlanCommand,
	ValidationFailed,
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
	issuedAt: () => IssuedAt;
};
export type CreateChangePlanWorkflow = (
	deps: ChangePlanWorkflowDeps,
) => ChangePlanWorkflow;

/** ① 未検証 → ② 検証済み。純粋関数。 */
export type ValidateChangePlanCommand = (
	command: UnvalidatedChangePlanCommand,
) => ResultType<ValidatedChangePlanCommand, ValidationFailed>;

/** ② 検証済み + 現在の状態 → ③ プラン変更結果。純粋関数（I/O を含まない）。 */
export type ChangePlanForSubscription = (
	command: ValidatedChangePlanCommand,
	subscription: Subscription,
	issued: { invoiceId: InvoiceId; issuedAt: IssuedAt },
) => ResultType<PlanChanged, Exclude<ChangePlanError, ValidationFailed>>;

// ===========================================================================
// 実装
// ===========================================================================

export const validateChangePlanCommand: ValidateChangePlanCommand = (command) =>
	Result.match(PlanId.create(command.planId), {
		ok: (planId): ResultType<ValidatedChangePlanCommand, ValidationFailed> =>
			ok({ planId }),
		err: (reason) => err({ kind: "ValidationFailed", reason }),
	});

const samePlan = (current: PlanIdType, requested: PlanIdType): boolean =>
	current.kind === requested.kind;

const samePlanError = (): ResultType<PlanChanged, SamePlan> =>
	err({ kind: "SamePlan" });

export const changePlanForSubscription: ChangePlanForSubscription = (
	command,
	subscription,
	issued,
) =>
	matchChoice<
		Subscription,
		ResultType<PlanChanged, Exclude<ChangePlanError, ValidationFailed>>
	>(subscription, {
		FreeSubscription: () => err<NotSubscribed>({ kind: "NotSubscribed" }),
		TrialSubscription: (current) => {
			if (samePlan(current.planId, command.planId)) {
				return samePlanError();
			}
			return ok({
				kind: "PaymentRequested",
				subscription: Subscription.pendingPayment({
					accountId: current.accountId,
					planId: command.planId,
					pendingInvoiceId: issued.invoiceId,
				}),
				invoice: Invoice.issue({
					id: issued.invoiceId,
					accountId: current.accountId,
					purpose: { kind: "New", planId: command.planId },
					issuedAt: issued.issuedAt,
				}),
			});
		},
		PendingPaymentSubscription: () =>
			err<PaymentPending>({ kind: "PaymentPending" }),
		PaidSubscription: (current) => {
			if (samePlan(current.planId, command.planId)) {
				return samePlanError();
			}
			return matchChoice<
				PlanChange,
				ResultType<PlanChanged, Exclude<ChangePlanError, ValidationFailed>>
			>(Plan.change(current.planId, command.planId), {
				Upgrade: ({ upgrade }) =>
					ok({
						kind: "UpgradeRequested",
						subscription: Subscription.upgradePending({
							accountId: current.accountId,
							planId: current.planId,
							periodEndsAt: current.periodEndsAt,
							pendingInvoiceId: issued.invoiceId,
						}),
						invoice: Invoice.issue({
							id: issued.invoiceId,
							accountId: current.accountId,
							purpose: { kind: "UpgradeDifference", upgrade },
							issuedAt: issued.issuedAt,
						}),
					}),
				Downgrade: () =>
					ok({
						kind: "PlanChangeReserved",
						subscription: Subscription.planChangeReserved({
							accountId: current.accountId,
							planId: current.planId,
							periodEndsAt: current.periodEndsAt,
							nextPlanId: command.planId,
						}),
					}),
			});
		},
		UpgradePendingSubscription: () =>
			err<PaymentPending>({ kind: "PaymentPending" }),
		CancelReservedSubscription: () =>
			err<ReservationExists>({ kind: "ReservationExists" }),
		PlanChangeReservedSubscription: () =>
			err<ReservationExists>({ kind: "ReservationExists" }),
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
					issuedAt: deps.issuedAt(),
				}),
			),
		);
