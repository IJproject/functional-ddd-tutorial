import { useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
import { UserId } from "#/domain/auth/model/user.primitive";
import {
	AsyncResult,
	matchChoice,
	ok,
	pipe,
	Result,
} from "#/domain/building-blocks";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import {
	type ApplyFieldError,
	type ApplyResponse,
	AUTHENTICATION_REQUIRED_APPLY_RESPONSE,
	applyCommandSchema,
	decodeApplyCommand,
	encodeApplyResponse,
	UNEXPECTED_APPLY_RESPONSE,
} from "#/domain/subscription/operation/apply/apply.dto";
import type { Applied } from "#/domain/subscription/operation/apply/apply.model";
import {
	applyToSubscription,
	createApplyWorkflow,
	validateApplyRequest,
} from "#/domain/subscription/operation/apply/apply.workflow";
import {
	ALREADY_SUBSCRIBED_APPLY_MESSAGE,
	APPLY_CONTEXT_UNAVAILABLE_MESSAGE,
	type ApplyContextView,
	encodeApplyContextView,
} from "#/domain/subscription/operation/apply/apply-context.dto";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadApplyContext,
	saveApplied,
} from "#/external/subscription-store/subscription-store";
import { LoginRequired } from "./login-required/login-required";
import { PlanList } from "./plan-list/plan-list";

// composition root: ドメインのポートに具体的な実装を差し込むのはここだけ。
const applyWorkflow = createApplyWorkflow({
	validateApplyRequest,
	applyToSubscription,
	newInvoiceId: () => InvoiceId.create(crypto.randomUUID()),
	now: () => new Date(),
});

/** auth BC の UserId を subscription BC の AccountId へ境界層で翻訳する。 */
const toAccountId = (userId: UserId): AccountId =>
	AccountId.create(UserId.value(userId));

const getApplyContext = createServerFn({ method: "GET" }).handler(async () => {
	const session = await currentSession();
	return matchChoice<typeof session, Promise<ApplyContextView>>(session, {
		AnonymousSession: async () => ({ loggedIn: false }),
		AuthenticatedSession: async ({ userId }) => {
			const loaded = await loadApplyContext(toAccountId(userId));
			return Result.match(loaded, {
				err: () => {
					// 読み取りの View は失敗の形を持たないため reject させ、クライアントの catch が APPLY_CONTEXT_UNAVAILABLE_MESSAGE を表示する。
					// StoreError の reason は内部情報なので例外にも載せない。
					throw new Error();
				},
				ok: (context) =>
					encodeApplyContextView(context.account, context.subscription),
			});
		},
	});
});

const applySubscription = createServerFn({ method: "POST" })
	.validator(applyCommandSchema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<ApplyResponse>>(session, {
			AnonymousSession: async () => AUTHENTICATION_REQUIRED_APPLY_RESPONSE,
			AuthenticatedSession: async ({ userId }) => {
				const accountId = toAccountId(userId);
				return pipe(
					loadApplyContext(accountId),
					AsyncResult.flatMap((context) =>
						applyWorkflow(
							decodeApplyCommand(data, AccountId.value(accountId)),
							context,
						),
					),
					AsyncResult.flatMap<Applied, Applied, never>(async (applied) => {
						await saveApplied(applied);
						return ok(applied);
					}),
					async (result) => encodeApplyResponse(await result),
				);
			},
		});
	});

export function ApplyPage() {
	const navigate = useNavigate();
	const [data, setData] = useState<ApplyContextView | null>(null);
	const [errors, setErrors] = useState<ApplyFieldError[]>([]);
	const [contextNotice, setContextNotice] = useState<string | null>(null);
	useEffect(() => {
		getApplyContext()
			.then(setData)
			.catch(() => setContextNotice(APPLY_CONTEXT_UNAVAILABLE_MESSAGE));
	}, []);

	/** field ごとの振り分け。field が null ならフォーム全体のエラー。 */
	const errorsFor = (field: ApplyFieldError["field"]) =>
		errors.filter((item) => item.field === field);
	const formErrors = errorsFor(null);
	const planErrors = errorsFor("planId");
	const visibleErrors = [...formErrors, ...planErrors];
	const errorMessages = [
		...visibleErrors.map((item) => item.message),
		...(contextNotice === null ? [] : [contextNotice]),
	];

	async function apply(planId: string) {
		try {
			const result = await applySubscription({ data: { planId } });
			if (!result.ok) {
				setErrors(result.errors);
				return;
			}
			setErrors([]);
			await navigate({ to: "/" });
		} catch {
			setErrors(UNEXPECTED_APPLY_RESPONSE.errors);
		}
	}
	if (!data)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					{errorMessages.length > 0 ? (
						<Alert messages={errorMessages} />
					) : (
						<p className="demo-note">読み込み中...</p>
					)}
				</section>
			</main>
		);
	if (!data.loggedIn)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					<LoginRequired errorMessages={errorMessages} />
				</section>
			</main>
		);
	return (
		<main className="demo-page">
			<section className="demo-panel space-y-6">
				<h1 className="demo-title">プランを申し込む</h1>
				<Alert messages={errorMessages} />
				{!data.applicable ? (
					<div className="space-y-4">
						<p className="demo-note">{ALREADY_SUBSCRIBED_APPLY_MESSAGE}</p>
						<Button kind="link" to="/">
							契約へ
						</Button>
					</div>
				) : (
					<PlanList
						plans={data.plans}
						trialUsed={data.trialUsed}
						onApply={apply}
					/>
				)}
			</section>
		</main>
	);
}
