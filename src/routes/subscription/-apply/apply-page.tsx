import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { UserId } from "#/domain/auth/model/user.primitive";
import { matchChoice, Result } from "#/domain/building-blocks";
import {
	type ApplyContextView,
	type ApplyFieldError,
	type ApplyResponse,
	applyCommandSchema,
	decodeApplyCommand,
	encodeApplyContextView,
	encodeApplyResponse,
	PAYMENT_REQUIRED_MESSAGE,
	TRIAL_AVAILABLE_MESSAGE,
} from "#/domain/subscription/dto/apply.dto";
import { STORE_UNAVAILABLE_MESSAGE } from "#/domain/subscription/dto/subscription-view.dto";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import {
	applyToSubscription,
	createApplyWorkflow,
	validateApplyRequest,
} from "#/domain/subscription/workflow/apply.workflow";
import { currentSession } from "#/external/better-auth/current-session";
import {
	loadApplyContext,
	saveApplied,
} from "#/external/subscription-store/subscription-store";

// ワークフロー外の失敗に対する文言。捕まえた例外の中身は表示しない。
const UNEXPECTED_APPLY_ERROR: ApplyFieldError = {
	field: null,
	message: "申し込みに失敗しました",
};

/** StoreError の開発者向け reason は捨て、画面には一律の文言だけを渡す。 */
const STORE_UNAVAILABLE_APPLY_ERROR: ApplyFieldError = {
	field: null,
	message: STORE_UNAVAILABLE_MESSAGE,
};

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
				// 例外にも内部理由を載せず、クライアント側の一律表示へ委ねる。
				err: () => {
					throw new Error(STORE_UNAVAILABLE_MESSAGE);
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
			AnonymousSession: async () => ({
				ok: false,
				errors: [UNEXPECTED_APPLY_ERROR],
			}),
			AuthenticatedSession: async ({ userId }) => {
				const accountId = toAccountId(userId);
				const loaded = await loadApplyContext(accountId);
				return Result.match(loaded, {
					err: async (): Promise<ApplyResponse> => ({
						ok: false,
						errors: [STORE_UNAVAILABLE_APPLY_ERROR],
					}),
					ok: async (context): Promise<ApplyResponse> => {
						const result = applyWorkflow(
							decodeApplyCommand(data, AccountId.value(accountId)),
							context,
						);
						await Result.match(result, {
							ok: saveApplied,
							err: async () => undefined,
						});
						return encodeApplyResponse(result);
					},
				});
			},
		});
	});

export function ApplyPage() {
	const navigate = useNavigate();
	const [data, setData] = useState<ApplyContextView | null>(null);
	const [errors, setErrors] = useState<ApplyFieldError[]>([]);
	useEffect(() => {
		getApplyContext()
			.then(setData)
			.catch(() => setErrors([STORE_UNAVAILABLE_APPLY_ERROR]));
	}, []);

	/** field ごとの振り分け。field: null はフォーム全体のエラー。 */
	const errorsFor = (field: ApplyFieldError["field"]) =>
		errors.filter((item) => item.field === field);
	const formErrors = errorsFor(null);
	const planErrors = errorsFor("planId");
	const visibleErrors = [...formErrors, ...planErrors];

	async function apply(planId: string) {
		try {
			const result = await applySubscription({ data: { planId } });
			if (!result.ok) {
				setErrors(result.errors);
				return;
			}
			setErrors([]);
			await navigate({ to: "/subscription/edit" });
		} catch {
			setErrors([UNEXPECTED_APPLY_ERROR]);
		}
	}
	if (!data)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					{visibleErrors.length > 0 ? (
						<div className="demo-alert demo-alert-danger">
							{visibleErrors.map((item) => (
								<p key={item.message}>{item.message}</p>
							))}
						</div>
					) : (
						"読み込み中..."
					)}
				</section>
			</main>
		);
	if (!data.loggedIn)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					<h1 className="demo-title">サブスク申し込み</h1>
					{visibleErrors.length > 0 && (
						<div className="demo-alert demo-alert-danger">
							{visibleErrors.map((item) => (
								<p key={item.message}>{item.message}</p>
							))}
						</div>
					)}
					<p>ログインしてください。</p>
					<Link to="/auth/login">ログインへ</Link>
				</section>
			</main>
		);
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">サブスクリプション</p>
				<h1 className="demo-title">プランを申し込む</h1>
				{visibleErrors.length > 0 && (
					<div className="demo-alert demo-alert-danger">
						{visibleErrors.map((item) => (
							<p key={item.message}>{item.message}</p>
						))}
					</div>
				)}
				{!data.applicable ? (
					<>
						<p>すでに契約中のため申し込みできません。</p>
						<Link to="/subscription/edit">契約へ</Link>
					</>
				) : (
					<div className="space-y-3">
						{data.plans.map((plan) => (
							<article
								className="demo-card flex items-center justify-between"
								key={plan.id}
							>
								<div>
									<strong>{plan.name}</strong>
									<p className="demo-muted">
										月額 ¥{plan.monthlyPrice.toLocaleString()}・
										{data.trialUsed
											? PAYMENT_REQUIRED_MESSAGE
											: TRIAL_AVAILABLE_MESSAGE}
									</p>
								</div>
								<button
									type="button"
									className="demo-button"
									onClick={() => apply(plan.id)}
								>
									申し込む
								</button>
							</article>
						))}
					</div>
				)}
			</section>
		</main>
	);
}
