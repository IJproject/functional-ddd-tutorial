import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { UserId } from "#/domain/auth/model/user.primitive";
import { matchChoice, Result } from "#/domain/building-blocks";
import {
	type CancelResponse,
	encodeCancelTrialResponse,
	encodeReserveCancellationResponse,
} from "#/domain/subscription/dto/cancel.dto";
import {
	type ChangePlanResponse,
	changePlanCommandSchema,
	decodeChangePlanCommand,
	encodeChangePlanResponse,
} from "#/domain/subscription/dto/change-plan.dto";
import {
	decodePaymentOutcome,
	encodePaymentResponse,
	INVOICE_NOT_FOUND_MESSAGE,
	type PayInvoiceCommand,
	type PaymentResponse,
	payInvoiceCommandSchema,
} from "#/domain/subscription/dto/payment.dto";
import {
	encodeEndPeriodResponse,
	encodeEndTrialResponse,
	type ScheduleResponse,
} from "#/domain/subscription/dto/schedule.dto";
import {
	encodeSubscriptionView,
	SUBSCRIPTION_EDIT_TEXT,
	type SubscriptionView,
} from "#/domain/subscription/dto/subscription-view.dto";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
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
		return matchChoice<typeof session, SubscriptionView>(session, {
			AnonymousSession: () => ({ loggedIn: false }),
			AuthenticatedSession: ({ userId }) => {
				const accountId = toAccountId(userId);
				return encodeSubscriptionView(
					loadSubscription(accountId),
					loadInvoices(accountId),
				);
			},
		});
	},
);

const requestPlanChange = createServerFn({ method: "POST" })
	.validator(changePlanCommandSchema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, ChangePlanResponse>(session, {
			AnonymousSession: () => ({
				ok: false,
				errors: [
					{ field: null, message: SUBSCRIPTION_EDIT_TEXT.loginRequired },
				],
			}),
			AuthenticatedSession: ({ userId }) => {
				const subscription = loadSubscription(toAccountId(userId));
				const result = changePlanWorkflow(
					decodeChangePlanCommand(data),
					subscription,
				);
				Result.match(result, { ok: savePlanChanged, err: () => undefined });
				return encodeChangePlanResponse(result);
			},
		});
	});

const cancelTrial = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, CancelResponse>(session, {
		AnonymousSession: () => ({
			ok: false,
			message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
		}),
		AuthenticatedSession: ({ userId }) => {
			const result = cancelTrialWorkflow(loadSubscription(toAccountId(userId)));
			Result.match(result, { ok: saveTrialCancelled, err: () => undefined });
			return encodeCancelTrialResponse(result);
		},
	});
});

const reserveCancellation = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await currentSession();
		return matchChoice<typeof session, CancelResponse>(session, {
			AnonymousSession: () => ({
				ok: false,
				message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
			}),
			AuthenticatedSession: ({ userId }) => {
				const result = reserveCancellationWorkflow(
					loadSubscription(toAccountId(userId)),
				);
				Result.match(result, {
					ok: saveCancellationReserved,
					err: () => undefined,
				});
				return encodeReserveCancellationResponse(result);
			},
		});
	},
);

const payInvoice = createServerFn({ method: "POST" })
	.validator(payInvoiceCommandSchema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, PaymentResponse>(session, {
			AnonymousSession: () => ({
				ok: false,
				message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
			}),
			AuthenticatedSession: ({ userId }) => {
				const accountId = toAccountId(userId);
				const invoice = findInvoice(
					accountId,
					InvoiceId.create(data.invoiceId),
				);
				if (!invoice) return { ok: false, message: INVOICE_NOT_FOUND_MESSAGE };
				const result = payInvoiceWorkflow(
					invoice,
					loadSubscription(accountId),
					decodePaymentOutcome(data),
					{ now: now() },
				);
				Result.match(result, { ok: savePaymentSettled, err: () => undefined });
				return encodePaymentResponse(result);
			},
		});
	});

const endTrial = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, ScheduleResponse>(session, {
		AnonymousSession: () => ({
			ok: false,
			message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
		}),
		AuthenticatedSession: ({ userId }) => {
			const result = endTrialWorkflow(loadSubscription(toAccountId(userId)));
			Result.match(result, { ok: saveTrialEnded, err: () => undefined });
			return encodeEndTrialResponse(result);
		},
	});
});

const endPeriod = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, ScheduleResponse>(session, {
		AnonymousSession: () => ({
			ok: false,
			message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
		}),
		AuthenticatedSession: ({ userId }) => {
			const result = endPeriodWorkflow(loadSubscription(toAccountId(userId)));
			Result.match(result, { ok: savePeriodEnded, err: () => undefined });
			return encodeEndPeriodResponse(result);
		},
	});
});

type ActionResponse =
	| ChangePlanResponse
	| CancelResponse
	| PaymentResponse
	| ScheduleResponse;

export function EditPage() {
	const [data, setData] = useState<SubscriptionView | null>(null);
	const [errors, setErrors] = useState<string[]>([]);
	const reload = useCallback(
		() =>
			getSubscriptionView()
				.then(setData)
				.catch(() => setErrors([SUBSCRIPTION_EDIT_TEXT.loadFailed])),
		[],
	);
	useEffect(() => {
		reload();
	}, [reload]);

	async function act(action: () => Promise<ActionResponse>) {
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
			setErrors([SUBSCRIPTION_EDIT_TEXT.operationFailed]);
		}
	}
	const pay = (invoiceId: string, result: PayInvoiceCommand["result"]) =>
		act(() => payInvoice({ data: { invoiceId, result } }));

	const errorAlert =
		errors.length > 0 ? (
			<div className="demo-alert demo-alert-danger">
				{errors.map((message) => (
					<p key={message}>{message}</p>
				))}
			</div>
		) : null;
	if (!data)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					{errorAlert ?? SUBSCRIPTION_EDIT_TEXT.loading}
				</section>
			</main>
		);
	if (!data.loggedIn)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					{errorAlert}
					<p>{SUBSCRIPTION_EDIT_TEXT.loginRequiredDescription}</p>
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
					<button
						type="button"
						className="demo-button-danger"
						onClick={() => act(cancelTrial)}
					>
						{SUBSCRIPTION_EDIT_TEXT.cancelTrial}
					</button>
				)}
				{state.periodEndsAt && (
					<p>
						{SUBSCRIPTION_EDIT_TEXT.periodEndLabel} {state.periodEndsAt}
					</p>
				)}
				{state.bookingText && <p>{state.bookingText}</p>}
				{state.canReserveCancellation && (
					<button
						type="button"
						className="demo-button-danger"
						onClick={() => act(reserveCancellation)}
					>
						{SUBSCRIPTION_EDIT_TEXT.reserveCancellation}
					</button>
				)}
			</section>
			<section className="demo-panel">
				<h2 className="demo-title">{SUBSCRIPTION_EDIT_TEXT.changePlanTitle}</h2>
				{state.showApplyLink ? (
					<>
						<p>{SUBSCRIPTION_EDIT_TEXT.applyFirst}</p>
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
									<button
										type="button"
										className="demo-button"
										disabled={plan.changeDisabled}
										onClick={() =>
											act(() =>
												requestPlanChange({ data: { planId: plan.id } }),
											)
										}
									>
										{SUBSCRIPTION_EDIT_TEXT.changePlan}
									</button>
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
							{invoice.payable && (
								<div className="flex gap-2">
									<button
										type="button"
										className="demo-button"
										onClick={() => pay(invoice.id, "success")}
									>
										{SUBSCRIPTION_EDIT_TEXT.paymentSucceeded}
									</button>
									<button
										type="button"
										className="demo-button-danger"
										onClick={() => pay(invoice.id, "failure")}
									>
										{SUBSCRIPTION_EDIT_TEXT.paymentFailed}
									</button>
								</div>
							)}
						</article>
					))}
					{data.invoices.length === 0 && (
						<p className="demo-muted">{SUBSCRIPTION_EDIT_TEXT.noInvoices}</p>
					)}
				</div>
			</section>
			<section className="demo-panel">
				<h2 className="demo-title">{SUBSCRIPTION_EDIT_TEXT.simulationTitle}</h2>
				<button
					type="button"
					className="demo-button-secondary mr-2"
					disabled={!state.canEndTrial}
					onClick={() => act(endTrial)}
				>
					{SUBSCRIPTION_EDIT_TEXT.endTrial}
				</button>
				<button
					type="button"
					className="demo-button-secondary"
					disabled={!state.canEndPeriod}
					onClick={() => act(endPeriod)}
				>
					{SUBSCRIPTION_EDIT_TEXT.endPeriod}
				</button>
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
