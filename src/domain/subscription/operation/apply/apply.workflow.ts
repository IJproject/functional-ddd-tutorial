import {
	err,
	matchChoice,
	ok,
	pipe,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { Account } from "#/domain/subscription/model/account.entity";
import type { TrialUsedAt } from "#/domain/subscription/model/account.primitive";
import {
	type InvoicePurpose,
	issuedAmount,
} from "#/domain/subscription/model/invoice.entity";
import type {
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { PlanId } from "#/domain/subscription/model/plan.model";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";
import { trialPeriodEnd } from "#/domain/subscription/model/subscription.primitive";
import type {
	AlreadySubscribed,
	Applied,
	ApplyContext,
	ApplyError,
	InvalidApplyCommand,
	UnvalidatedApplyCommand,
	ValidatedApplyCommand,
} from "#/domain/subscription/operation/apply/apply.model";

// ===========================================================================
// 型定義
// ===========================================================================

export type ApplyWorkflow = (
	command: UnvalidatedApplyCommand,
	context: ApplyContext,
) => ResultType<Applied, ApplyError>;

export type ApplyWorkflowDeps = {
	newInvoiceId: () => InvoiceId;
	issuedAt: () => IssuedAt;
	trialUsedAt: () => TrialUsedAt;
};
export type CreateApplyWorkflow = (deps: ApplyWorkflowDeps) => ApplyWorkflow;

/** ① 未検証 → ② 検証済み。純粋関数。 */
export type ValidateApplyCommand = (
	command: UnvalidatedApplyCommand,
) => ResultType<ValidatedApplyCommand, InvalidApplyCommand>;

/** ② 検証済み + 現在の状態 → ③ 申し込み結果。純粋関数（I/O を含まない）。 */
export type ApplyToSubscription = (
	command: ValidatedApplyCommand,
	context: ApplyContext,
	issued: {
		invoiceId: InvoiceId;
		issuedAt: IssuedAt;
		trialUsedAt: TrialUsedAt;
	},
) => ResultType<Applied, AlreadySubscribed>;

// ===========================================================================
// 実装
// ===========================================================================

export const validateApplyCommand: ValidateApplyCommand = (command) => {
	return Result.match(PlanId.create(command.planId), {
		ok: (planId): ResultType<ValidatedApplyCommand, InvalidApplyCommand> =>
			ok({ planId }),
		err: (reason) => err({ kind: "InvalidApplyCommand", reason }),
	});
};

const alreadySubscribed = (): ResultType<Applied, AlreadySubscribed> =>
	err({ kind: "AlreadySubscribed" });

export const applyToSubscription: ApplyToSubscription = (
	command,
	context,
	issued,
) =>
	matchChoice<Subscription, ResultType<Applied, AlreadySubscribed>>(
		context.subscription,
		{
			FreeSubscription: () =>
				matchChoice<Account, ResultType<Applied, AlreadySubscribed>>(
					context.account,
					{
						TrialUnusedAccount: (account) =>
							ok({
								kind: "TrialStarted",
								account: {
									kind: "TrialUsedAccount",
									id: account.id,
									trialUsedAt: issued.trialUsedAt,
								},
								subscription: {
									kind: "TrialSubscription",
									accountId: context.account.id,
									planId: command.planId,
									trialEndsAt: trialPeriodEnd(issued.trialUsedAt),
								},
							}),
						TrialUsedAccount: () => {
							const purpose: InvoicePurpose = {
								kind: "New",
								planId: command.planId,
							};
							return ok({
								kind: "PaymentRequested",
								subscription: {
									kind: "PendingPaymentSubscription",
									accountId: context.account.id,
									planId: command.planId,
									pendingInvoiceId: issued.invoiceId,
								},
								invoice: {
									kind: "UnpaidInvoice",
									id: issued.invoiceId,
									accountId: context.account.id,
									amount: issuedAmount(purpose),
									purpose,
									issuedAt: issued.issuedAt,
								},
							});
						},
					},
				),
			TrialSubscription: alreadySubscribed,
			PendingPaymentSubscription: alreadySubscribed,
			PaidSubscription: alreadySubscribed,
			UpgradePendingSubscription: alreadySubscribed,
			CancelReservedSubscription: alreadySubscribed,
			PlanChangeReservedSubscription: alreadySubscribed,
		},
	);

/**
 * 全段が純粋関数で I/O を含まないため AsyncResult ではなく Result を使う。
 * 検証が成功したときだけ状態遷移へ進むよう、pipe と Result.flatMap で連結する。
 */
export const createApplyWorkflow: CreateApplyWorkflow =
	(deps) => (command, context) =>
		pipe(
			validateApplyCommand(command),
			Result.flatMap((validated) =>
				applyToSubscription(validated, context, {
					invoiceId: deps.newInvoiceId(),
					issuedAt: deps.issuedAt(),
					trialUsedAt: deps.trialUsedAt(),
				}),
			),
		);
