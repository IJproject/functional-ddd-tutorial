import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
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
	APPLY_BEFORE_PLAN_CHANGE_MESSAGE,
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

const SUBSCRIPTION_EDIT_TEXT = {
	loading: "読み込み中...",
	loginLink: "ログインへ",
	kicker: "サブスクリプション",
	contractTitle: "契約",
	trialEndLabel: "トライアル終了日:",
	periodEndLabel: "期間満了日:",
	cancelTrial: "トライアルを解約する",
	applyLink: "サブスクを申し込む",
	reserveCancellation: "解約を予約する",
	changePlanTitle: "プラン変更",
	applyNavigation: "申し込みへ",
	currentPlanLabel: "現在のプラン:",
	changePlan: "変更する",
	invoicesTitle: "請求一覧",
	invoiceDetailLink: "詳細を見る",
	paymentSimulationDescription: "決済サービスの代わりに手動で結果を入れます。",
	paymentSucceeded: "（模擬）支払い成功",
	paymentFailed: "（模擬）支払い失敗",
	simulationTitle: "開発用シミュレーション",
	endTrial: "（模擬）トライアル終了日を迎える",
	endPeriod: "（模擬）期間満了日を迎える",
	otherScreens: "他の画面へ:",
	applyShort: "申し込み",
} as const;

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

export function EditPage() {
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
					{errors.length > 0 ? errorAlert : SUBSCRIPTION_EDIT_TEXT.loading}
				</section>
			</main>
		);
	if (!data.loggedIn)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					{errorAlert}
					<p>{SUBSCRIPTION_LOGIN_REQUIRED_MESSAGE}</p>
					<Link to="/auth/login">{SUBSCRIPTION_EDIT_TEXT.loginLink}</Link>
				</section>
			</main>
		);

	const { state } = data;
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">{SUBSCRIPTION_EDIT_TEXT.kicker}</p>
				<h1 className="demo-title">{SUBSCRIPTION_EDIT_TEXT.contractTitle}</h1>
				{errorAlert}
				<p>
					<strong>{state.planName ?? state.statusLabel}</strong>（
					{state.statusLabel}）
				</p>
				{state.notice && <p>{state.notice}</p>}
				{state.showApplyLink && (
					<Link to="/subscription/apply">
						{SUBSCRIPTION_EDIT_TEXT.applyLink}
					</Link>
				)}
				{state.trialEndsAt && (
					<p>
						{SUBSCRIPTION_EDIT_TEXT.trialEndLabel} {state.trialEndsAt}
					</p>
				)}
				{state.canCancelTrial && (
					<Button
						kind="action"
						variant="danger"
						onClick={() => act(cancelTrial, UNEXPECTED_CANCEL_RESPONSE)}
					>
						{SUBSCRIPTION_EDIT_TEXT.cancelTrial}
					</Button>
				)}
				{state.periodEndsAt && (
					<p>
						{SUBSCRIPTION_EDIT_TEXT.periodEndLabel} {state.periodEndsAt}
					</p>
				)}
				{state.bookingText && <p>{state.bookingText}</p>}
				{state.canReserveCancellation && (
					<Button
						kind="action"
						variant="danger"
						onClick={() => act(reserveCancellation, UNEXPECTED_CANCEL_RESPONSE)}
					>
						{SUBSCRIPTION_EDIT_TEXT.reserveCancellation}
					</Button>
				)}
			</section>
			<section className="demo-panel">
				<h2 className="demo-title">{SUBSCRIPTION_EDIT_TEXT.changePlanTitle}</h2>
				{state.showApplyLink ? (
					<>
						<p>{APPLY_BEFORE_PLAN_CHANGE_MESSAGE}</p>
						<Link to="/subscription/apply">
							{SUBSCRIPTION_EDIT_TEXT.applyNavigation}
						</Link>
					</>
				) : (
					<>
						<p>
							{SUBSCRIPTION_EDIT_TEXT.currentPlanLabel}{" "}
							<strong>{state.planName}</strong>（{state.statusLabel}）
						</p>
						<div className="space-y-3">
							{data.plans.map((plan) => (
								<article
									className="demo-card flex items-center justify-between"
									key={plan.id}
								>
									<div>
										<strong>{plan.name}</strong>
										<p className="demo-muted">{plan.changeDescription}</p>
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
										{SUBSCRIPTION_EDIT_TEXT.changePlan}
									</Button>
								</article>
							))}
						</div>
					</>
				)}
			</section>
			<section className="demo-panel">
				<h2 className="demo-title">{SUBSCRIPTION_EDIT_TEXT.invoicesTitle}</h2>
				<p className="demo-muted">
					{SUBSCRIPTION_EDIT_TEXT.paymentSimulationDescription}
				</p>
				<div className="space-y-3">
					{data.invoices.map((invoice) => (
						<article className="demo-card" key={invoice.id}>
							<p>
								{invoice.purposeLabel} / {invoice.planName} / ¥
								{invoice.amount.toLocaleString()} / {invoice.statusLabel}
							</p>
							<p className="demo-muted text-sm">{invoice.issuedAt}</p>
							<Link
								to="/subscription/invoice/$invoiceId"
								params={{ invoiceId: invoice.id }}
							>
								{SUBSCRIPTION_EDIT_TEXT.invoiceDetailLink}
							</Link>
							{invoice.payable && (
								<div className="flex gap-2">
									<Button
										kind="action"
										onClick={() => pay(invoice.id, "success")}
									>
										{SUBSCRIPTION_EDIT_TEXT.paymentSucceeded}
									</Button>
									<Button
										kind="action"
										variant="danger"
										onClick={() => pay(invoice.id, "failure")}
									>
										{SUBSCRIPTION_EDIT_TEXT.paymentFailed}
									</Button>
								</div>
							)}
						</article>
					))}
					{data.invoices.length === 0 && (
						<p className="demo-muted">{NO_INVOICES_MESSAGE}</p>
					)}
				</div>
			</section>
			<section className="demo-panel">
				<h2 className="demo-title">{SUBSCRIPTION_EDIT_TEXT.simulationTitle}</h2>
				<Button
					kind="action"
					variant="secondary"
					className="mr-2"
					disabled={!state.canEndTrial}
					onClick={() => act(endTrial, UNEXPECTED_END_TRIAL_RESPONSE)}
				>
					{SUBSCRIPTION_EDIT_TEXT.endTrial}
				</Button>
				<Button
					kind="action"
					variant="secondary"
					disabled={!state.canEndPeriod}
					onClick={() => act(endPeriod, UNEXPECTED_END_PERIOD_RESPONSE)}
				>
					{SUBSCRIPTION_EDIT_TEXT.endPeriod}
				</Button>
			</section>
			<p className="demo-muted">
				{SUBSCRIPTION_EDIT_TEXT.otherScreens}{" "}
				<Link to="/subscription/apply">
					{SUBSCRIPTION_EDIT_TEXT.applyShort}
				</Link>
			</p>
		</main>
	);
}
