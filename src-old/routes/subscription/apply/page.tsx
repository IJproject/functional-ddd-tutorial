import { useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { apply, applyView } from "#/application/subscription/apply";
import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
import {
	type ApplyFieldError,
	ApplyRequest,
	ApplyResponse,
} from "#/domain/subscription/operation/apply/apply.dto";
import {
	APPLY_VIEW_UNAVAILABLE_MESSAGE,
	type ApplyView,
} from "#/domain/subscription/operation/apply/apply-view.dto";
import { LoginRequired } from "./-login-required/login-required";
import { PlanList } from "./-plan-list/plan-list";

const getApplyView = createServerFn({ method: "GET" }).handler(applyView);

const applySubscription = createServerFn({ method: "POST" })
	.validator(ApplyRequest.schema)
	.handler(async ({ data }) => apply(data));

export function ApplyPage() {
	const navigate = useNavigate();
	// 取得の状態（ページのもの）
	const [view, setView] = useState<ApplyView | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	// 申し込みの結果（ページのもの）
	const [errors, setErrors] = useState<ApplyFieldError[]>([]);
	useEffect(() => {
		getApplyView()
			.then(setView)
			.catch(() => setLoadFailed(true));
	}, []);

	/** field ごとの振り分け。field が null ならフォーム全体のエラー。 */
	const errorsFor = (field: ApplyFieldError["field"]) =>
		errors.filter((item) => item.field === field);
	const formErrors = errorsFor(null);
	const planErrors = errorsFor("planId");
	const alerts = [
		...[...formErrors, ...planErrors].map((item) => item.message),
		...(loadFailed ? [APPLY_VIEW_UNAVAILABLE_MESSAGE] : []),
		...(view && "alert" in view ? [view.alert] : []),
	];

	async function handleApply(planId: string) {
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
	return (
		<main className="demo-page">
			<section className="demo-panel space-y-6">
				<h1 className="demo-title">プランを申し込む</h1>
				<Alert messages={alerts} />
				{view === null && !loadFailed && (
					<p className="demo-note">読み込み中...</p>
				)}
				{view && "loginPrompt" in view && (
					<LoginRequired message={view.loginPrompt} />
				)}
				{view && "subscribedNotice" in view && (
					<div className="space-y-4">
						<p className="demo-note">{view.subscribedNotice}</p>
						<Button kind="link" to="/">
							契約へ
						</Button>
					</div>
				)}
				{view && "plans" in view && (
					<PlanList
						plans={view.plans}
						notice={view.planNotice}
						onApply={handleApply}
					/>
				)}
			</section>
		</main>
	);
}
