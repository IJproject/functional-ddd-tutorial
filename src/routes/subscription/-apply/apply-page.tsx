import { useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type ReactNode, useEffect, useState } from "react";
import {
	apply as applyAction,
	applyContext,
} from "#/application/subscription/apply";
import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
import { matchChoice } from "#/domain/building-blocks";
import {
	type ApplyFieldError,
	ApplyRequest,
	ApplyResponse,
} from "#/domain/subscription/operation/apply/apply.dto";
import {
	ALREADY_SUBSCRIBED_APPLY_MESSAGE,
	APPLY_CONTEXT_UNAVAILABLE_MESSAGE,
	type ApplyContextView,
} from "#/domain/subscription/operation/apply/apply-context.dto";
import { LoginRequired } from "./login-required/login-required";
import { PlanList } from "./plan-list/plan-list";

const getApplyContext = createServerFn({ method: "GET" }).handler(applyContext);

const applySubscription = createServerFn({ method: "POST" })
	.validator(ApplyRequest.schema)
	.handler(async ({ data }) => applyAction(data));

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
			setErrors(ApplyResponse.unexpected.errors);
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
	return matchChoice<ApplyContextView, ReactNode>(data, {
		AnonymousApplyContext: () => (
			<main className="demo-page">
				<section className="demo-panel">
					<LoginRequired errorMessages={errorMessages} />
				</section>
			</main>
		),
		ApplyContextUnavailable: () => (
			<main className="demo-page">
				<section className="demo-panel">
					<Alert
						messages={[...errorMessages, APPLY_CONTEXT_UNAVAILABLE_MESSAGE]}
					/>
				</section>
			</main>
		),
		ApplyContextFound: ({ applicable, plans, trialUsed }) => (
			<main className="demo-page">
				<section className="demo-panel space-y-6">
					<h1 className="demo-title">プランを申し込む</h1>
					<Alert messages={errorMessages} />
					{!applicable ? (
						<div className="space-y-4">
							<p className="demo-note">{ALREADY_SUBSCRIBED_APPLY_MESSAGE}</p>
							<Button kind="link" to="/">
								契約へ
							</Button>
						</div>
					) : (
						<PlanList plans={plans} trialUsed={trialUsed} onApply={apply} />
					)}
				</section>
			</main>
		),
	});
}
