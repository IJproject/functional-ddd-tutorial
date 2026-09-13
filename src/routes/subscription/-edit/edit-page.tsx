import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
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
	STORE_UNAVAILABLE_MESSAGE,
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

/** StoreError の reason は内部情報なので捨て、どの操作でも同じ公開文言へ落とす。 */
const STORE_UNAVAILABLE_RESPONSE = {
	ok: false,
	message: STORE_UNAVAILABLE_MESSAGE,
} as const;

const STORE_UNAVAILABLE_CHANGE_PLAN_RESPONSE: ChangePlanResponse = {
	ok: false,
	errors: [{ field: null, message: STORE_UNAVAILABLE_MESSAGE }],
};

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
					// クライアントへ StoreError の reason を運ばないため、公開文言だけで失敗させる。
					err: () => {
						throw new Error(STORE_UNAVAILABLE_MESSAGE);
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
			AnonymousSession: async () => ({
				ok: false,
				errors: [
					{ field: null, message: SUBSCRIPTION_EDIT_TEXT.loginRequired },
				],
			}),
			AuthenticatedSession: async ({ userId }) => {
				const loaded = await loadSubscription(toAccountId(userId));
				return Result.match(loaded, {
					err: async () => STORE_UNAVAILABLE_CHANGE_PLAN_RESPONSE,
					ok: async (subscription): Promise<ChangePlanResponse> => {
						const result = changePlanWorkflow(
							decodeChangePlanCommand(data),
							subscription,
						);
						await Result.match(result, {
							ok: savePlanChanged,
							err: async () => undefined,
						});
						return encodeChangePlanResponse(result);
					},
				});
			},
		});
	});

const cancelTrial = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<CancelResponse>>(session, {
		AnonymousSession: async () => ({
			ok: false,
			message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
		}),
		AuthenticatedSession: async ({ userId }) => {
			const loaded = await loadSubscription(toAccountId(userId));
			return Result.match(loaded, {
				err: async () => STORE_UNAVAILABLE_RESPONSE,
				ok: async (subscription): Promise<CancelResponse> => {
					const result = cancelTrialWorkflow(subscription);
					await Result.match(result, {
						ok: saveTrialCancelled,
						err: async () => undefined,
					});
					return encodeCancelTrialResponse(result);
				},
			});
		},
	});
});

const reserveCancellation = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<CancelResponse>>(session, {
			AnonymousSession: async () => ({
				ok: false,
				message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
			}),
			AuthenticatedSession: async ({ userId }) => {
				const loaded = await loadSubscription(toAccountId(userId));
				return Result.match(loaded, {
					err: async () => STORE_UNAVAILABLE_RESPONSE,
					ok: async (subscription): Promise<CancelResponse> => {
						const result = reserveCancellationWorkflow(subscription);
						await Result.match(result, {
							ok: saveCancellationReserved,
							err: async () => undefined,
						});
						return encodeReserveCancellationResponse(result);
					},
				});
			},
		});
	},
);

const payInvoice = createServerFn({ method: "POST" })
	.validator(payInvoiceCommandSchema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<PaymentResponse>>(session, {
			AnonymousSession: async () => ({
				ok: false,
				message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
			}),
			AuthenticatedSession: async ({ userId }) => {
				const accountId = toAccountId(userId);
				const [invoice, subscription] = await Promise.all([
					findInvoice(accountId, InvoiceId.create(data.invoiceId)),
					loadSubscription(accountId),
				]);
				return Result.match(Result.combine([invoice, subscription]), {
					err: async () => STORE_UNAVAILABLE_RESPONSE,
					ok: async ([domainInvoice, domainSubscription]) => {
						if (!domainInvoice)
							return { ok: false, message: INVOICE_NOT_FOUND_MESSAGE };
						const result = payInvoiceWorkflow(
							domainInvoice,
							domainSubscription,
							decodePaymentOutcome(data),
							{ now: now() },
						);
						await Result.match(result, {
							ok: savePaymentSettled,
							err: async () => undefined,
						});
						return encodePaymentResponse(result);
					},
				});
			},
		});
	});

const endTrial = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<ScheduleResponse>>(session, {
		AnonymousSession: async () => ({
			ok: false,
			message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
		}),
		AuthenticatedSession: async ({ userId }) => {
			const loaded = await loadSubscription(toAccountId(userId));
			return Result.match(loaded, {
				err: async () => STORE_UNAVAILABLE_RESPONSE,
				ok: async (subscription): Promise<ScheduleResponse> => {
					const result = endTrialWorkflow(subscription);
					await Result.match(result, {
						ok: saveTrialEnded,
						err: async () => undefined,
					});
					return encodeEndTrialResponse(result);
				},
			});
		},
	});
});

const endPeriod = createServerFn({ method: "POST" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<ScheduleResponse>>(session, {
		AnonymousSession: async () => ({
			ok: false,
			message: SUBSCRIPTION_EDIT_TEXT.loginRequired,
		}),
		AuthenticatedSession: async ({ userId }) => {
			const loaded = await loadSubscription(toAccountId(userId));
			return Result.match(loaded, {
				err: async () => STORE_UNAVAILABLE_RESPONSE,
				ok: async (subscription): Promise<ScheduleResponse> => {
					const result = endPeriodWorkflow(subscription);
					await Result.match(result, {
						ok: savePeriodEnded,
						err: async () => undefined,
					});
					return encodeEndPeriodResponse(result);
				},
			});
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
				.catch(() => setErrors([STORE_UNAVAILABLE_MESSAGE])),
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
					<Button
						kind="action"
						variant="danger"
						onClick={() => act(cancelTrial)}
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
						onClick={() => act(reserveCancellation)}
					>
						{SUBSCRIPTION_EDIT_TEXT.reserveCancellation}
					</Button>
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
									<Button
										kind="action"
										disabled={plan.changeDisabled}
										onClick={() =>
											act(() =>
												requestPlanChange({ data: { planId: plan.id } }),
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
						<p className="demo-muted">{SUBSCRIPTION_EDIT_TEXT.noInvoices}</p>
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
					onClick={() => act(endTrial)}
				>
					{SUBSCRIPTION_EDIT_TEXT.endTrial}
				</Button>
				<Button
					kind="action"
					variant="secondary"
					disabled={!state.canEndPeriod}
					onClick={() => act(endPeriod)}
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
