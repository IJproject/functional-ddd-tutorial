import { createServerFn } from "@tanstack/react-start";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { sessionView } from "#/application/auth/session-view";
import {
	cancelTrial as cancelTrialAction,
	reserveCancellation as reserveCancellationAction,
} from "#/application/subscription/cancel";
import { changePlan as changePlanAction } from "#/application/subscription/change-plan";
import { payInvoice as payInvoiceAction } from "#/application/subscription/payment";
import {
	endPeriod as endPeriodAction,
	endTrial as endTrialAction,
} from "#/application/subscription/schedule";
import { subscriptionView } from "#/application/subscription/subscription-view";
import { Button } from "#/components/control/button";
import { Badge, type BadgeTone } from "#/components/data/badge";
import { Alert } from "#/components/feedback/alert";
import { matchChoice } from "#/domain/building-blocks";
import {
	CancelTrialResponse,
	ReserveCancellationResponse,
} from "#/domain/subscription/operation/cancel/cancel.dto";
import {
	ChangePlanRequest,
	ChangePlanResponse,
} from "#/domain/subscription/operation/change-plan/change-plan.dto";
import {
	PayInvoiceRequest,
	PaymentResponse,
} from "#/domain/subscription/operation/payment/payment.dto";
import {
	EndPeriodResponse,
	EndTrialResponse,
} from "#/domain/subscription/operation/schedule/schedule.dto";
import {
	type InvoiceView,
	NO_INVOICES_MESSAGE,
	type PlanOptionView,
	SUBSCRIPTION_LOGIN_REQUIRED_MESSAGE,
	SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE,
	type SubscriptionStateView,
	type SubscriptionView,
} from "#/domain/subscription/operation/subscription-view/subscription-view.dto";

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

/** 状態バッジの色。表示用の色は DTO の case で網羅する。 */
const STATUS_TONE: Record<SubscriptionStateView["kind"], BadgeTone> = {
	Free: "neutral",
	Trial: "info",
	PendingPayment: "warning",
	Paid: "success",
	UpgradePending: "success",
	CancelReserved: "success",
	PlanChangeReserved: "success",
};

/** 請求バッジの色。 */
const INVOICE_STATUS_TONE: Record<InvoiceView["kind"], BadgeTone> = {
	Unpaid: "warning",
	Paid: "success",
	Failed: "danger",
};

/** `/` のガード用。ログイン済みかどうかだけを返す。 */
export const fetchHomeSession = createServerFn({ method: "GET" }).handler(
	sessionView,
);

const getSubscriptionView = createServerFn({ method: "GET" }).handler(
	subscriptionView,
);

const requestPlanChange = createServerFn({ method: "POST" })
	.validator(ChangePlanRequest.schema)
	.handler(async ({ data }) => changePlanAction(data));

const cancelTrial = createServerFn({ method: "POST" }).handler(
	cancelTrialAction,
);

const reserveCancellation = createServerFn({ method: "POST" }).handler(
	reserveCancellationAction,
);

const payInvoice = createServerFn({ method: "POST" })
	.validator(PayInvoiceRequest.schema)
	.handler(async ({ data }) => payInvoiceAction(data));

const endTrial = createServerFn({ method: "POST" }).handler(endTrialAction);

const endPeriod = createServerFn({ method: "POST" }).handler(endPeriodAction);

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

	const subscribedHeading = (
		state: Exclude<SubscriptionStateView, { kind: "Free" }>,
		note?: string,
	) => (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="demo-metric">{state.planName}</h1>
				<Badge tone={STATUS_TONE[state.kind]}>{state.statusLabel}</Badge>
			</div>
			{note && <p className="demo-note">{note}</p>}
		</div>
	);

	const renderHeading = (state: SubscriptionStateView): ReactNode =>
		matchChoice<SubscriptionStateView, ReactNode>(state, {
			Free: ({ statusLabel, notice }) => (
				<div className="space-y-2">
					<h1 className="demo-metric">{statusLabel}</h1>
					<p className="demo-note">{notice}</p>
				</div>
			),
			Trial: (current) => subscribedHeading(current),
			PendingPayment: (current) => subscribedHeading(current, current.notice),
			Paid: (current) => subscribedHeading(current),
			UpgradePending: (current) => subscribedHeading(current),
			CancelReserved: (current) =>
				subscribedHeading(current, current.bookingText),
			PlanChangeReserved: (current) =>
				subscribedHeading(current, current.bookingText),
		});

	const dateField = (label: string, value: string) => (
		<div className="flex flex-wrap gap-x-10 gap-y-4">
			<div className="space-y-1">
				<p className="demo-label">{label}</p>
				<p className="demo-value">{value}</p>
			</div>
		</div>
	);
	const renderDate = (state: SubscriptionStateView): ReactNode =>
		matchChoice<SubscriptionStateView, ReactNode>(state, {
			Free: () => null,
			Trial: ({ trialEndsAt }) =>
				dateField(HOME_TEXT.trialEndLabel, trialEndsAt),
			PendingPayment: () => null,
			Paid: ({ periodEndsAt }) =>
				dateField(HOME_TEXT.periodEndLabel, periodEndsAt),
			UpgradePending: ({ periodEndsAt }) =>
				dateField(HOME_TEXT.periodEndLabel, periodEndsAt),
			CancelReserved: ({ periodEndsAt }) =>
				dateField(HOME_TEXT.periodEndLabel, periodEndsAt),
			PlanChangeReserved: ({ periodEndsAt }) =>
				dateField(HOME_TEXT.periodEndLabel, periodEndsAt),
		});

	const reserveCancellationButton = () => (
		<div className="flex flex-wrap gap-3">
			<Button
				kind="action"
				variant="danger"
				onClick={() =>
					act(reserveCancellation, ReserveCancellationResponse.unexpected)
				}
			>
				{HOME_TEXT.reserveCancellation}
			</Button>
		</div>
	);
	const renderActions = (state: SubscriptionStateView): ReactNode =>
		matchChoice<SubscriptionStateView, ReactNode>(state, {
			Free: () => (
				<div className="flex flex-wrap gap-3">
					<Button kind="link" to="/subscription/apply">
						{HOME_TEXT.applyLink}
					</Button>
				</div>
			),
			Trial: () => (
				<div className="flex flex-wrap gap-3">
					<Button
						kind="action"
						variant="danger"
						onClick={() => act(cancelTrial, CancelTrialResponse.unexpected)}
					>
						{HOME_TEXT.cancelTrial}
					</Button>
				</div>
			),
			PendingPayment: () => null,
			Paid: reserveCancellationButton,
			UpgradePending: () => null,
			CancelReserved: () => null,
			PlanChangeReserved: reserveCancellationButton,
		});

	const renderPlanOption = (plan: PlanOptionView): ReactNode =>
		matchChoice<PlanOptionView, ReactNode>(plan, {
			CurrentPlan: (current) => (
				<article
					className="demo-card flex flex-wrap items-center justify-between gap-4"
					key={current.id}
				>
					<div className="space-y-1">
						<p className="demo-metric-sm">{current.name}</p>
					</div>
					<Button kind="action" disabled onClick={() => {}}>
						{HOME_TEXT.changePlan}
					</Button>
				</article>
			),
			ChangeablePlan: (changeable) => (
				<article
					className="demo-card flex flex-wrap items-center justify-between gap-4"
					key={changeable.id}
				>
					<div className="space-y-1">
						<p className="demo-metric-sm">{changeable.name}</p>
						<p className="demo-note">{changeable.changeDescription}</p>
					</div>
					<Button
						kind="action"
						onClick={() =>
							act(
								() => requestPlanChange({ data: { planId: changeable.id } }),
								ChangePlanResponse.unexpected,
							)
						}
					>
						{HOME_TEXT.changePlan}
					</Button>
				</article>
			),
		});

	const planChangeSection = (
		state: Extract<SubscriptionStateView, { kind: "Trial" | "Paid" }>,
	) => (
		<section className="demo-panel space-y-6">
			<h2 className="demo-section-title">{HOME_TEXT.changePlanTitle}</h2>
			<div className="space-y-6">
				<div className="space-y-1">
					<p className="demo-label">{HOME_TEXT.currentPlanLabel}</p>
					<div className="flex flex-wrap items-center gap-2">
						<p className="demo-value">{state.planName}</p>
						<Badge tone={STATUS_TONE[state.kind]}>{state.statusLabel}</Badge>
					</div>
				</div>
				<div className="space-y-4">
					{state.planOptions.map(renderPlanOption)}
				</div>
			</div>
		</section>
	);
	const renderPlanChange = (state: SubscriptionStateView): ReactNode =>
		matchChoice<SubscriptionStateView, ReactNode>(state, {
			Free: () => null,
			Trial: planChangeSection,
			PendingPayment: () => null,
			Paid: planChangeSection,
			UpgradePending: () => null,
			CancelReserved: () => null,
			PlanChangeReserved: () => null,
		});

	/** 期日を迎えさせられるもの。どの状態でもセクションは出し、押せるボタンを状態で決める。 */
	type SimulationTarget = "TrialEnd" | "PeriodEnd" | "None";
	const simulationSection = (target: SimulationTarget) => (
		<section className="demo-panel space-y-4">
			<h2 className="demo-section-title">{HOME_TEXT.simulationTitle}</h2>
			<div className="flex flex-wrap gap-3">
				<Button
					kind="action"
					variant="secondary"
					disabled={target !== "TrialEnd"}
					onClick={() => act(endTrial, EndTrialResponse.unexpected)}
				>
					{HOME_TEXT.endTrial}
				</Button>
				<Button
					kind="action"
					variant="secondary"
					disabled={target !== "PeriodEnd"}
					onClick={() => act(endPeriod, EndPeriodResponse.unexpected)}
				>
					{HOME_TEXT.endPeriod}
				</Button>
			</div>
		</section>
	);
	const renderSimulation = (state: SubscriptionStateView): ReactNode =>
		matchChoice<SubscriptionStateView, ReactNode>(state, {
			Free: () => simulationSection("None"),
			Trial: () => simulationSection("TrialEnd"),
			PendingPayment: () => simulationSection("None"),
			Paid: () => simulationSection("PeriodEnd"),
			UpgradePending: () => simulationSection("None"),
			CancelReserved: () => simulationSection("PeriodEnd"),
			PlanChangeReserved: () => simulationSection("PeriodEnd"),
		});

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
	return matchChoice<SubscriptionView, ReactNode>(data, {
		AnonymousSubscription: () => (
			<main className="demo-page">
				<section className="demo-panel space-y-4">
					{errorAlert}
					<p className="demo-note">{SUBSCRIPTION_LOGIN_REQUIRED_MESSAGE}</p>
					<Button kind="link" to="/auth/login">
						{HOME_TEXT.loginLink}
					</Button>
				</section>
			</main>
		),
		SubscriptionUnavailable: () => (
			<main className="demo-page">
				<section className="demo-panel">
					<Alert messages={[SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE]} />
				</section>
			</main>
		),
		SubscriptionFound: ({ state, invoices }) => (
			<main className="demo-page">
				<section className="demo-panel space-y-6">
					{errorAlert}
					{renderHeading(state)}
					{renderDate(state)}
					{renderActions(state)}
				</section>
				{renderPlanChange(state)}
				<section className="demo-panel space-y-6">
					<div className="space-y-2">
						<h2 className="demo-section-title">{HOME_TEXT.invoicesTitle}</h2>
						<p className="demo-note">
							{HOME_TEXT.paymentSimulationDescription}
						</p>
					</div>
					<div className="space-y-4">
						{invoices.map((invoice) => (
							<article className="demo-card space-y-4" key={invoice.id}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="demo-metric-sm">
												¥{invoice.amount.toLocaleString()}
											</p>
											<Badge tone={INVOICE_STATUS_TONE[invoice.kind]}>
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
								{matchChoice<InvoiceView, ReactNode>(invoice, {
									Unpaid: (current) => (
										<div className="flex flex-wrap gap-2">
											<Button kind="action" onClick={() => pay(current.id)}>
												{HOME_TEXT.payInvoice}
											</Button>
										</div>
									),
									Paid: () => null,
									Failed: () => null,
								})}
							</article>
						))}
						{invoices.length === 0 && (
							<p className="demo-note">{NO_INVOICES_MESSAGE}</p>
						)}
					</div>
				</section>
				{renderSimulation(state)}
			</main>
		),
	});
}
