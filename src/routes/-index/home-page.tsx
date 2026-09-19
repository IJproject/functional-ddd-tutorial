import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Button } from "#/components/control/button";
import { Badge, type BadgeTone } from "#/components/data/badge";
import { Alert } from "#/components/feedback/alert";
import type { Session } from "#/domain/auth/model/session.model";
import { UserId } from "#/domain/auth/model/user.primitive";
import {
	AsyncResult,
	err,
	matchChoice,
	ok,
	pipe,
	Result,
} from "#/domain/building-blocks";
import {
	AUTHENTICATION_REQUIRED_CANCEL_RESPONSE,
	type CancelResponse,
	encodeCancelTrialResponse,
	encodeReserveCancellationResponse,
	UNEXPECTED_CANCEL_RESPONSE,
} from "#/domain/subscription/dto/cancel.dto";
import {
	AUTHENTICATION_REQUIRED_CHANGE_PLAN_RESPONSE,
	type ChangePlanResponse,
	changePlanCommandSchema,
	decodeChangePlanCommand,
	encodeChangePlanResponse,
	UNEXPECTED_CHANGE_PLAN_RESPONSE,
} from "#/domain/subscription/dto/change-plan.dto";
import {
	AUTHENTICATION_REQUIRED_PAYMENT_RESPONSE,
	decodePaymentOutcome,
	encodePaymentResponse,
	type PayInvoiceCommand,
	type PaymentResponse,
	payInvoiceCommandSchema,
	UNEXPECTED_PAYMENT_RESPONSE,
} from "#/domain/subscription/dto/payment.dto";
import {
	AUTHENTICATION_REQUIRED_END_PERIOD_RESPONSE,
	AUTHENTICATION_REQUIRED_END_TRIAL_RESPONSE,
	encodeEndPeriodResponse,
	encodeEndTrialResponse,
	type ScheduleResponse,
	UNEXPECTED_END_PERIOD_RESPONSE,
	UNEXPECTED_END_TRIAL_RESPONSE,
} from "#/domain/subscription/dto/schedule.dto";
import {
	encodeSubscriptionView,
	NO_INVOICES_MESSAGE,
	SUBSCRIPTION_LOGIN_REQUIRED_MESSAGE,
	SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE,
	type SubscriptionView,
} from "#/domain/subscription/dto/subscription-view.dto";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import type {
	CancellationReserved,
	TrialCancelled,
} from "#/domain/subscription/model/cancel.model";
import type { PlanChanged } from "#/domain/subscription/model/change-plan.model";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import type {
	InvoiceNotFound,
	PayInvoiceError,
	PaymentSettled,
} from "#/domain/subscription/model/payment.model";
import type {
	PeriodEnded,
	TrialEnded,
} from "#/domain/subscription/model/schedule.model";
import {
	cancelTrial as cancelTrialForSubscription,
	createCancelTrialWorkflow,
	createReserveCancellationWorkflow,
	reserveCancellation as reserveCancellationForSubscription,
} from "#/domain/subscription/workflow/cancel.workflow";
import {
	changePlanForSubscription,
	createChangePlanWorkflow,
	validateChangePlanRequest,
} from "#/domain/subscription/workflow/change-plan.workflow";
import {
	createPayInvoiceWorkflow,
	payInvoice as payInvoiceForSubscription,
} from "#/domain/subscription/workflow/payment.workflow";
import {
	createEndPeriodWorkflow,
	createEndTrialWorkflow,
	endPeriod as endPeriodForSubscription,
	endTrial as endTrialForSubscription,
} from "#/domain/subscription/workflow/schedule.workflow";
import { currentSession } from "#/external/better-auth/current-session";
import {
	findInvoice,
	loadInvoices,
	loadSubscription,
	saveCancellationReserved,
	savePaymentSettled,
	savePeriodEnded,
	savePlanChanged,
	saveTrialCancelled,
	saveTrialEnded,
} from "#/external/subscription-store/subscription-store";

const HOME_TEXT = {
	loading: "読み込み中...",
	loginLink: "ログインへ",
	trialEndLabel: "トライアル終了日",
	periodEndLabel: "期間満了日",
	cancelTrial: "トライアルを解約する",
	applyLink: "サブスクを申し込む",
	reserveCancellation: "解約を予約する",
	changePlanTitle: "プラン変更",
	currentPlanLabel: "現在のプラン",
	changePlan: "変更する",
	invoicesTitle: "請求一覧",
	invoiceDetailLink: "詳細を見る",
	paymentSimulationDescription: "決済サービスの代わりに手動で結果を入れます。",
	paymentSucceeded: "（模擬）支払い成功",
	paymentFailed: "（模擬）支払い失敗",
	simulationTitle: "開発用シミュレーション",
	endTrial: "（模擬）トライアル終了日を迎える",
	endPeriod: "（模擬）期間満了日を迎える",
} as const;

/**
 * 状態バッジの色。色は表示の都合なので DTO には持たせず、ここで決める。
 * キーは SubscriptionStateView.statusLabel の文言。DTO 側の文言を変えると
 * ここから外れて neutral に落ちる（型では検出できない）ことは承知の上の割り切り。
 */
const STATUS_TONE: Record<string, BadgeTone> = {
	無料プラン: "neutral",
	トライアル中: "info",
	支払い待ち: "warning",
	有料契約中: "success",
};

/**
 * 請求バッジの色。STATUS_TONE と同じ理由でここに置く（色は表示の都合であり DTO の関心ではない）。
 * キーは InvoiceView.statusLabel の文言。
 */
const INVOICE_STATUS_TONE: Record<string, BadgeTone> = {
	未払い: "warning",
	支払い済み: "success",
	失敗: "danger",
};

/** `/` のガード用。ログイン済みかどうかだけを返す。 */
export const fetchHomeSession = createServerFn({ method: "GET" }).handler(
	async (): Promise<{ loggedIn: boolean }> => {
		const session = await currentSession();
		return {
			loggedIn: matchChoice<Session, boolean>(session, {
				AuthenticatedSession: () => true,
				AnonymousSession: () => false,
			}),
		};
	},
);

// composition root: ドメインのポートに具体的な実装を差し込むのはここだけ。
const newInvoiceId = () => InvoiceId.create(crypto.randomUUID());
const now = () => new Date();
const changePlanWorkflow = createChangePlanWorkflow({
	validateChangePlanRequest,
	changePlanForSubscription,
	newInvoiceId,
	now,
});
const cancelTrialWorkflow = createCancelTrialWorkflow({
	cancelTrial: cancelTrialForSubscription,
});
const reserveCancellationWorkflow = createReserveCancellationWorkflow({
	reserveCancellation: reserveCancellationForSubscription,
});
const payInvoiceWorkflow = createPayInvoiceWorkflow({
	payInvoice: payInvoiceForSubscription,
});
const endTrialWorkflow = createEndTrialWorkflow({
	endTrial: endTrialForSubscription,
	newInvoiceId,
	now,
});
const endPeriodWorkflow = createEndPeriodWorkflow({
	endPeriod: endPeriodForSubscription,
	newInvoiceId,
	now,
});

/** auth BC の UserId を subscription BC の AccountId へ境界層で翻訳する。 */
const toAccountId = (userId: UserId): AccountId =>
	AccountId.create(UserId.value(userId));

const getSubscriptionView = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<SubscriptionView>>(session, {
			AnonymousSession: async () => ({ loggedIn: false }),
			AuthenticatedSession: async ({ userId }) => {
				const accountId = toAccountId(userId);
				const [subscription, invoices] = await Promise.all([
					loadSubscription(accountId),
					loadInvoices(accountId),
				]);
				return Result.match(Result.combine([subscription, invoices]), {
					err: () => {
						// 読み取りの View は失敗の形を持たないため reject させ、クライアントの catch が SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE を表示する。
						// StoreError の reason は内部情報なので例外にも載せない。
						throw new Error();
					},
					ok: ([domainSubscription, domainInvoices]) =>
						encodeSubscriptionView(domainSubscription, domainInvoices),
				});
			},
		});
	},
);

const requestPlanChange = createServerFn({ method: "POST" })
	.validator(changePlanCommandSchema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<ChangePlanResponse>>(session, {
			AnonymousSession: async () =>
				AUTHENTICATION_REQUIRED_CHANGE_PLAN_RESPONSE,
			AuthenticatedSession: async ({ userId }) =>
				pipe(
					loadSubscription(toAccountId(userId)),
					AsyncResult.flatMap((subscription) =>
						changePlanWorkflow(decodeChangePlanCommand(data), subscription),
					),
					AsyncResult.flatMap<PlanChanged, PlanChanged, never>(
						async (changed) => {
							await savePlanChanged(changed);
							return ok(changed);
						},
					),
					async (result) => encodeChangePlanResponse(await result),
				),
		});
	});

const cancelTrial = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<CancelResponse>>(session, {
		AnonymousSession: async () => AUTHENTICATION_REQUIRED_CANCEL_RESPONSE,
		AuthenticatedSession: async ({ userId }) =>
			pipe(
				loadSubscription(toAccountId(userId)),
				AsyncResult.flatMap(cancelTrialWorkflow),
				AsyncResult.flatMap<TrialCancelled, TrialCancelled, never>(
					async (cancelled) => {
						await saveTrialCancelled(cancelled);
						return ok(cancelled);
					},
				),
				async (result) => encodeCancelTrialResponse(await result),
			),
	});
});

const reserveCancellation = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<CancelResponse>>(session, {
			AnonymousSession: async () => AUTHENTICATION_REQUIRED_CANCEL_RESPONSE,
			AuthenticatedSession: async ({ userId }) =>
				pipe(
					loadSubscription(toAccountId(userId)),
					AsyncResult.flatMap(reserveCancellationWorkflow),
					AsyncResult.flatMap<
						CancellationReserved,
						CancellationReserved,
						never
					>(async (reserved) => {
						await saveCancellationReserved(reserved);
						return ok(reserved);
					}),
					async (result) => encodeReserveCancellationResponse(await result),
				),
		});
	},
);

const payInvoice = createServerFn({ method: "POST" })
	.validator(payInvoiceCommandSchema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<PaymentResponse>>(session, {
			AnonymousSession: async () => AUTHENTICATION_REQUIRED_PAYMENT_RESPONSE,
			AuthenticatedSession: async ({ userId }) => {
				const accountId = toAccountId(userId);
				const [invoice, subscription] = await Promise.all([
					findInvoice(accountId, InvoiceId.create(data.invoiceId)),
					loadSubscription(accountId),
				]);
				return pipe(
					Result.combine([invoice, subscription] as const),
					AsyncResult.flatMap(
						([domainInvoice, domainSubscription]): Result<
							PaymentSettled,
							PayInvoiceError | InvoiceNotFound
						> =>
							domainInvoice === null
								? err<InvoiceNotFound>({ kind: "InvoiceNotFound" })
								: payInvoiceWorkflow(
										domainInvoice,
										domainSubscription,
										decodePaymentOutcome(data),
										{ now: now() },
									),
					),
					AsyncResult.flatMap<PaymentSettled, PaymentSettled, never>(
						async (settled) => {
							await savePaymentSettled(settled);
							return ok(settled);
						},
					),
					async (result) => encodePaymentResponse(await result),
				);
			},
		});
	});

const endTrial = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<ScheduleResponse>>(session, {
		AnonymousSession: async () => AUTHENTICATION_REQUIRED_END_TRIAL_RESPONSE,
		AuthenticatedSession: async ({ userId }) =>
			pipe(
				loadSubscription(toAccountId(userId)),
				AsyncResult.flatMap(endTrialWorkflow),
				AsyncResult.flatMap<TrialEnded, TrialEnded, never>(async (ended) => {
					await saveTrialEnded(ended);
					return ok(ended);
				}),
				async (result) => encodeEndTrialResponse(await result),
			),
	});
});

const endPeriod = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<ScheduleResponse>>(session, {
		AnonymousSession: async () => AUTHENTICATION_REQUIRED_END_PERIOD_RESPONSE,
		AuthenticatedSession: async ({ userId }) =>
			pipe(
				loadSubscription(toAccountId(userId)),
				AsyncResult.flatMap(endPeriodWorkflow),
				AsyncResult.flatMap<PeriodEnded, PeriodEnded, never>(async (ended) => {
					await savePeriodEnded(ended);
					return ok(ended);
				}),
				async (result) => encodeEndPeriodResponse(await result),
			),
	});
});

type ActionResponse =
	| ChangePlanResponse
	| CancelResponse
	| PaymentResponse
	| ScheduleResponse;
type FailedActionResponse = Exclude<ActionResponse, { ok: true }>;

export function HomePage() {
	const [data, setData] = useState<SubscriptionView | null>(null);
	const [errors, setErrors] = useState<string[]>([]);
	const reload = useCallback(
		() =>
			getSubscriptionView()
				.then(setData)
				.catch(() => setErrors([SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE])),
		[],
	);
	useEffect(() => {
		reload();
	}, [reload]);

	async function act(
		action: () => Promise<ActionResponse>,
		unexpected: FailedActionResponse,
	) {
		try {
			setErrors([]);
			const response = await action();
			if (!response.ok) {
				setErrors(
					"errors" in response
						? response.errors.map((item) => item.message)
						: [response.message],
				);
				return;
			}
			await reload();
		} catch {
			setErrors(
				"errors" in unexpected
					? unexpected.errors.map((item) => item.message)
					: [unexpected.message],
			);
		}
	}
	const pay = (invoiceId: string, result: PayInvoiceCommand["result"]) =>
		act(
			() => payInvoice({ data: { invoiceId, result } }),
			UNEXPECTED_PAYMENT_RESPONSE,
		);

	const errorAlert = <Alert messages={errors} />;
	if (!data)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					{errors.length > 0 ? (
						errorAlert
					) : (
						<p className="demo-note">{HOME_TEXT.loading}</p>
					)}
				</section>
			</main>
		);
	if (!data.loggedIn)
		return (
			<main className="demo-page">
				<section className="demo-panel space-y-4">
					{errorAlert}
					<p className="demo-note">{SUBSCRIPTION_LOGIN_REQUIRED_MESSAGE}</p>
					<Button kind="link" to="/auth/login">
						{HOME_TEXT.loginLink}
					</Button>
				</section>
			</main>
		);

	const { state } = data;
	return (
		<main className="demo-page">
			<section className="demo-panel space-y-6">
				{errorAlert}
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="demo-metric">
							{state.planName ?? state.statusLabel}
						</h1>
						{state.planName !== null && (
							<Badge tone={STATUS_TONE[state.statusLabel] ?? "neutral"}>
								{state.statusLabel}
							</Badge>
						)}
					</div>
					{state.notice && <p className="demo-note">{state.notice}</p>}
					{state.bookingText && (
						<p className="demo-note">{state.bookingText}</p>
					)}
				</div>
				{(state.trialEndsAt || state.periodEndsAt) && (
					<div className="flex flex-wrap gap-x-10 gap-y-4">
						{state.trialEndsAt && (
							<div className="space-y-1">
								<p className="demo-label">{HOME_TEXT.trialEndLabel}</p>
								<p className="demo-value">{state.trialEndsAt}</p>
							</div>
						)}
						{state.periodEndsAt && (
							<div className="space-y-1">
								<p className="demo-label">{HOME_TEXT.periodEndLabel}</p>
								<p className="demo-value">{state.periodEndsAt}</p>
							</div>
						)}
					</div>
				)}
				{(state.showApplyLink ||
					state.canCancelTrial ||
					state.canReserveCancellation) && (
					<div className="flex flex-wrap gap-3">
						{state.showApplyLink && (
							<Button kind="link" to="/subscription/apply">
								{HOME_TEXT.applyLink}
							</Button>
						)}
						{state.canCancelTrial && (
							<Button
								kind="action"
								variant="danger"
								onClick={() => act(cancelTrial, UNEXPECTED_CANCEL_RESPONSE)}
							>
								{HOME_TEXT.cancelTrial}
							</Button>
						)}
						{state.canReserveCancellation && (
							<Button
								kind="action"
								variant="danger"
								onClick={() =>
									act(reserveCancellation, UNEXPECTED_CANCEL_RESPONSE)
								}
							>
								{HOME_TEXT.reserveCancellation}
							</Button>
						)}
					</div>
				)}
			</section>
			{/*
			 * プラン変更が実際にできる状態のときだけ出す。
			 * 無料プランのときは「先に申し込んでください」と案内するだけで、
			 * 行き先がヒーローの「サブスクを申し込む」と同じになり導線が重複するため。
			 */}
			{!state.showApplyLink && (
				<section className="demo-panel space-y-6">
					<h2 className="demo-section-title">{HOME_TEXT.changePlanTitle}</h2>
					<div className="space-y-6">
						<div className="space-y-1">
							<p className="demo-label">{HOME_TEXT.currentPlanLabel}</p>
							<div className="flex flex-wrap items-center gap-2">
								<p className="demo-value">{state.planName}</p>
								<Badge tone={STATUS_TONE[state.statusLabel] ?? "neutral"}>
									{state.statusLabel}
								</Badge>
							</div>
						</div>
						<div className="space-y-4">
							{data.plans.map((plan) => (
								<article
									className="demo-card flex flex-wrap items-center justify-between gap-4"
									key={plan.id}
								>
									<div className="space-y-1">
										<p className="demo-metric-sm">{plan.name}</p>
										<p className="demo-note">{plan.changeDescription}</p>
									</div>
									<Button
										kind="action"
										disabled={plan.changeDisabled}
										onClick={() =>
											act(
												() => requestPlanChange({ data: { planId: plan.id } }),
												UNEXPECTED_CHANGE_PLAN_RESPONSE,
											)
										}
									>
										{HOME_TEXT.changePlan}
									</Button>
								</article>
							))}
						</div>
					</div>
				</section>
			)}
			<section className="demo-panel space-y-6">
				<div className="space-y-2">
					<h2 className="demo-section-title">{HOME_TEXT.invoicesTitle}</h2>
					<p className="demo-note">{HOME_TEXT.paymentSimulationDescription}</p>
				</div>
				<div className="space-y-4">
					{data.invoices.map((invoice) => (
						<article className="demo-card space-y-4" key={invoice.id}>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="space-y-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="demo-metric-sm">
											¥{invoice.amount.toLocaleString()}
										</p>
										<Badge
											tone={
												INVOICE_STATUS_TONE[invoice.statusLabel] ?? "neutral"
											}
										>
											{invoice.statusLabel}
										</Badge>
									</div>
									<p className="demo-note">
										{invoice.purposeLabel}・{invoice.planName}
									</p>
									<p className="demo-note">{invoice.issuedAt}</p>
								</div>
								<Button
									kind="link"
									variant="secondary"
									to="/subscription/invoice/$invoiceId"
									params={{ invoiceId: invoice.id }}
								>
									{HOME_TEXT.invoiceDetailLink}
								</Button>
							</div>
							{invoice.payable && (
								<div className="flex flex-wrap gap-2">
									<Button
										kind="action"
										onClick={() => pay(invoice.id, "success")}
									>
										{HOME_TEXT.paymentSucceeded}
									</Button>
									<Button
										kind="action"
										variant="danger"
										onClick={() => pay(invoice.id, "failure")}
									>
										{HOME_TEXT.paymentFailed}
									</Button>
								</div>
							)}
						</article>
					))}
					{data.invoices.length === 0 && (
						<p className="demo-note">{NO_INVOICES_MESSAGE}</p>
					)}
				</div>
			</section>
			<section className="demo-panel space-y-4">
				<h2 className="demo-section-title">{HOME_TEXT.simulationTitle}</h2>
				<div className="flex flex-wrap gap-3">
					<Button
						kind="action"
						variant="secondary"
						disabled={!state.canEndTrial}
						onClick={() => act(endTrial, UNEXPECTED_END_TRIAL_RESPONSE)}
					>
						{HOME_TEXT.endTrial}
					</Button>
					<Button
						kind="action"
						variant="secondary"
						disabled={!state.canEndPeriod}
						onClick={() => act(endPeriod, UNEXPECTED_END_PERIOD_RESPONSE)}
					>
						{HOME_TEXT.endPeriod}
					</Button>
				</div>
			</section>
		</main>
	);
}
