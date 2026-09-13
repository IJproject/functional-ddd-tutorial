import {
	err,
	matchChoice,
	ok,
	pipe,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { Account } from "#/domain/subscription/model/account.model";
import {
	AccountId,
	TrialUsedAt,
} from "#/domain/subscription/model/account.primitive";
import type {
	AlreadySubscribed,
	Applied,
	ApplyContext,
	ApplyError,
	ApplyRequest,
	InvalidApplyRequest,
	UnvalidatedApplyRequest,
} from "#/domain/subscription/model/apply.model";
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
import { TrialEndsAt } from "#/domain/subscription/model/subscription.primitive";

// ===========================================================================
// 型定義
// ===========================================================================

/** ① 未検証 → ② 検証済み。純粋関数。 */
export type ValidateApplyRequest = (
	request: UnvalidatedApplyRequest,
) => ResultType<ApplyRequest, InvalidApplyRequest>;

/** ② 検証済み + 現在の状態 → ③ 申し込み結果。純粋関数（I/O を含まない）。 */
export type ApplyToSubscription = (
	request: ApplyRequest,
	context: ApplyContext,
	issued: { invoiceId: InvoiceId; now: Date },
) => ResultType<Applied, AlreadySubscribed>;

export type ApplyWorkflowDeps = {
	validateApplyRequest: ValidateApplyRequest;
	applyToSubscription: ApplyToSubscription;
	newInvoiceId: () => InvoiceId;
	now: () => Date;
};

export type ApplyWorkflow = (
	request: UnvalidatedApplyRequest,
	context: ApplyContext,
) => ResultType<Applied, ApplyError>;

export type CreateApplyWorkflow = (deps: ApplyWorkflowDeps) => ApplyWorkflow;

// ===========================================================================
// 実装
// ===========================================================================

/** 無料トライアルの日数。 */
export const TRIAL_DAYS = 14;

const PLAN_IDS: Readonly<Record<string, PlanId | undefined>> = {
	Basic: PlanId.create("Basic"),
	Pro: PlanId.create("Pro"),
};

/**
 * accountId は境界層が認証済みセッションから渡す信頼済みの値なので、
 * 形式検証はせず AccountId.create を通すだけにする。
 */
export const validateApplyRequest: ValidateApplyRequest = (request) => {
	const planId = PLAN_IDS[request.planId];
	return planId
		? ok({ accountId: AccountId.create(request.accountId), planId })
		: err({
				kind: "InvalidApplyRequest",
				reason: { kind: "UnknownPlan" },
			});
};

const alreadySubscribed = (): ResultType<Applied, AlreadySubscribed> =>
	err({ kind: "AlreadySubscribed" });

export const applyToSubscription: ApplyToSubscription = (
	request,
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
									trialUsedAt: TrialUsedAt.create(issued.now),
								},
								subscription: {
									kind: "TrialSubscription",
									accountId: request.accountId,
									planId: request.planId,
									trialEndsAt: TrialEndsAt.create(
										new Date(
											issued.now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
										),
									),
								},
							}),
						TrialUsedAccount: () => {
							const plan = Plan.of(request.planId);
							return ok({
								kind: "PaymentRequested",
								subscription: {
									kind: "PendingPaymentSubscription",
									accountId: request.accountId,
									planId: request.planId,
									pendingInvoiceId: issued.invoiceId,
								},
								invoice: {
									kind: "UnpaidInvoice",
									id: issued.invoiceId,
									accountId: request.accountId,
									planId: request.planId,
									amount: Amount.create(MonthlyPrice.value(plan.monthlyPrice)),
									purpose: { kind: "New" },
									issuedAt: IssuedAt.create(issued.now),
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
	(deps) => (request, context) =>
		pipe(
			deps.validateApplyRequest(request),
			Result.flatMap((validated) =>
				deps.applyToSubscription(validated, context, {
					invoiceId: deps.newInvoiceId(),
					now: deps.now(),
				}),
			),
		);
