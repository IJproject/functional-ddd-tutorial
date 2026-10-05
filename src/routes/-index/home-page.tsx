import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
	cancelTrial as cancelTrialAction,
	reserveCancellation as reserveCancellationAction,
} from "#/application/subscription/cancel";
import { Button } from "#/components/control/button";
import { Badge, type BadgeTone } from "#/components/data/badge";
import { Alert } from "#/components/feedback/alert";
import type { Session } from "#/domain/auth/model/session.model";
import {
	AsyncResult,
	err,
	matchChoice,
	ok,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import {
	CancelTrialResponse,
	ReserveCancellationResponse,
} from "#/domain/subscription/operation/cancel/cancel.dto";
import {
	ChangePlanRequest,
	ChangePlanResponse,
} from "#/domain/subscription/operation/change-plan/change-plan.dto";
import type { PlanChanged } from "#/domain/subscription/operation/change-plan/change-plan.model";
import { createChangePlanWorkflow } from "#/domain/subscription/operation/change-plan/change-plan.workflow";
import {
	PayInvoiceRequest,
	PaymentResponse,
} from "#/domain/subscription/operation/payment/payment.dto";
import type {
	InvoiceNotFound,
	PayInvoiceError,
	PaymentSettled,
} from "#/domain/subscription/operation/payment/payment.model";
import { createPayInvoiceWorkflow } from "#/domain/subscription/operation/payment/payment.workflow";
import { createEndPeriodWorkflow } from "#/domain/subscription/operation/schedule/end-period.workflow";
import { createEndTrialWorkflow } from "#/domain/subscription/operation/schedule/end-trial.workflow";
import {
	EndPeriodResponse,
	EndTrialResponse,
} from "#/domain/subscription/operation/schedule/schedule.dto";
import type {
	PeriodEnded,
	TrialEnded,
} from "#/domain/subscription/operation/schedule/schedule.model";
import {
	NO_INVOICES_MESSAGE,
	SUBSCRIPTION_LOGIN_REQUIRED_MESSAGE,
	SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE,
	SubscriptionView,
} from "#/domain/subscription/operation/subscription-view/subscription-view.dto";
import { currentSession } from "#/external/better-auth/current-session";
import { chargeInvoice } from "#/external/payment-gateway/charge-invoice";
import {
	findInvoice,
	loadInvoices,
	loadSubscription,
	savePaymentSettled,
	savePeriodEnded,
	savePlanChanged,
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
	paymentSimulationDescription:
		"決済サービスの代わりにフェイクのゲートウェイが応答します。成否は請求 ID で決まります。",
	payInvoice: "（模擬）支払う",
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

// composition root: ドメインのポートに具体的な実装を差し込む。
const newInvoiceId = () => InvoiceId.create(crypto.randomUUID());
const now = () => new Date();
const changePlanWorkflow = createChangePlanWorkflow({
	newInvoiceId,
	now,
});
const payInvoiceWorkflow = createPayInvoiceWorkflow({
	chargeInvoice,
});
const endTrialWorkflow = createEndTrialWorkflow({
	newInvoiceId,
	now,
});
const endPeriodWorkflow = createEndPeriodWorkflow({
	newInvoiceId,
	now,
});

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
						SubscriptionView.encode(domainSubscription, domainInvoices),
				});
			},
		});
	},
);

const requestPlanChange = createServerFn({ method: "POST" })
	.validator(ChangePlanRequest.schema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<ChangePlanResponse>>(session, {
			AnonymousSession: async () => ChangePlanResponse.authenticationRequired,
			AuthenticatedSession: async ({ userId }) =>
				pipe(
					loadSubscription(toAccountId(userId)),
					AsyncResult.flatMap((subscription) =>
						changePlanWorkflow(ChangePlanRequest.decode(data), subscription),
					),
					AsyncResult.flatMap<PlanChanged, PlanChanged, never>(
						async (changed) => {
							await savePlanChanged(changed);
							return ok(changed);
						},
					),
					async (result) => ChangePlanResponse.encode(await result),
				),
		});
	});

const cancelTrial = createServerFn({ method: "POST" }).handler(
	cancelTrialAction,
);

const reserveCancellation = createServerFn({ method: "POST" }).handler(
	reserveCancellationAction,
);

const payInvoice = createServerFn({ method: "POST" })
	.validator(PayInvoiceRequest.schema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<PaymentResponse>>(session, {
			AnonymousSession: async () => PaymentResponse.authenticationRequired,
			AuthenticatedSession: async ({ userId }) => {
				const accountId = toAccountId(userId);
				const [invoice, subscription] = await Promise.all([
					findInvoice(accountId, InvoiceId.create(data.invoiceId)),
					loadSubscription(accountId),
				]);
				return pipe(
					Result.combine([invoice, subscription] as const),
					AsyncResult.flatMap(
						([domainInvoice, domainSubscription]): AsyncResult<
							PaymentSettled,
							PayInvoiceError | InvoiceNotFound
						> =>
							domainInvoice === null
								? Promise.resolve(
										err<InvoiceNotFound>({ kind: "InvoiceNotFound" }),
									)
								: payInvoiceWorkflow(domainInvoice, domainSubscription, {
										now: now(),
									}),
					),
					AsyncResult.flatMap<PaymentSettled, PaymentSettled, never>(
						async (settled) => {
							await savePaymentSettled(settled);
							return ok(settled);
						},
					),
					async (result) => PaymentResponse.encode(await result),
				);
			},
		});
	});

const endTrial = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<EndTrialResponse>>(session, {
		AnonymousSession: async () => EndTrialResponse.authenticationRequired,
		AuthenticatedSession: async ({ userId }) =>
			pipe(
				loadSubscription(toAccountId(userId)),
				AsyncResult.flatMap(endTrialWorkflow),
				AsyncResult.flatMap<TrialEnded, TrialEnded, never>(async (ended) => {
					await saveTrialEnded(ended);
					return ok(ended);
				}),
				async (result) => EndTrialResponse.encode(await result),
			),
	});
});

const endPeriod = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<EndPeriodResponse>>(session, {
		AnonymousSession: async () => EndPeriodResponse.authenticationRequired,
		AuthenticatedSession: async ({ userId }) =>
			pipe(
				loadSubscription(toAccountId(userId)),
				AsyncResult.flatMap(endPeriodWorkflow),
				AsyncResult.flatMap<PeriodEnded, PeriodEnded, never>(async (ended) => {
					await savePeriodEnded(ended);
					return ok(ended);
				}),
				async (result) => EndPeriodResponse.encode(await result),
			),
	});
});

type ActionResponse =
	| ChangePlanResponse
	| CancelTrialResponse
	| ReserveCancellationResponse
	| PaymentResponse
	| EndTrialResponse
	| EndPeriodResponse;
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
	const pay = (invoiceId: string) =>
		act(() => payInvoice({ data: { invoiceId } }), PaymentResponse.unexpected);

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
								onClick={() => act(cancelTrial, CancelTrialResponse.unexpected)}
							>
								{HOME_TEXT.cancelTrial}
							</Button>
						)}
						{state.canReserveCancellation && (
							<Button
								kind="action"
								variant="danger"
								onClick={() =>
									act(
										reserveCancellation,
										ReserveCancellationResponse.unexpected,
									)
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
												ChangePlanResponse.unexpected,
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
									<Button kind="action" onClick={() => pay(invoice.id)}>
										{HOME_TEXT.payInvoice}
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
						onClick={() => act(endTrial, EndTrialResponse.unexpected)}
					>
						{HOME_TEXT.endTrial}
					</Button>
					<Button
						kind="action"
						variant="secondary"
						disabled={!state.canEndPeriod}
						onClick={() => act(endPeriod, EndPeriodResponse.unexpected)}
					>
						{HOME_TEXT.endPeriod}
					</Button>
				</div>
			</section>
		</main>
	);
}
