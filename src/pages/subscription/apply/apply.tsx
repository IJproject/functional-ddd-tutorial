import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

type PlanId = "free" | "basic" | "pro";
const PLANS = [
	{ id: "free", name: "無料プラン", monthlyPrice: 0 },
	{ id: "basic", name: "ベーシック", monthlyPrice: 980 },
	{ id: "pro", name: "プロ", monthlyPrice: 2980 },
] as const;
const TRIAL_DAYS = 14;
type Account = {
	id: string;
	email: string;
	password: string;
	name: string;
	billingAddress: string;
	paymentMethod: string;
	trialUsed: boolean;
	createdAt: string;
};
type Subscription = {
	accountId: string;
	status: "free" | "trial" | "pending_payment" | "paid";
	planId: PlanId;
	trialEndsAt?: string;
	periodEndsAt?: string;
	reservation?: { kind: "cancel" } | { kind: "change_plan"; planId: PlanId };
	pendingInvoiceId?: string;
};
type Invoice = {
	id: string;
	accountId: string;
	planId: PlanId;
	amount: number;
	kind: "new" | "renewal" | "upgrade_diff";
	status: "unpaid" | "paid" | "failed";
	createdAt: string;
};
type Store = {
	accounts: Account[];
	subscriptions: Subscription[];
	invoices: Invoice[];
	currentAccountId: string | null;
};
const globalStore = globalThis as { __subscStore?: Store };
globalStore.__subscStore ??= {
	accounts: [],
	subscriptions: [],
	invoices: [],
	currentAccountId: null,
};
const store: Store = globalStore.__subscStore;

const getApplyContext = createServerFn({ method: "GET" }).handler(async () => {
	const id = store.currentAccountId;
	const sub = store.subscriptions.find((item) => item.accountId === id);
	const account = store.accounts.find((item) => item.id === id);
	return id && sub && account
		? {
				loggedIn: true as const,
				status: sub.status,
				trialUsed: account.trialUsed,
				plans: PLANS.filter((plan) => plan.id !== "free"),
			}
		: { loggedIn: false as const };
});
const applySubscription = createServerFn({ method: "POST" })
	.validator((d: unknown) => d as { planId: PlanId })
	.handler(async ({ data }) => {
		const id = store.currentAccountId;
		const sub = store.subscriptions.find((item) => item.accountId === id);
		const account = store.accounts.find((item) => item.id === id);
		if (!sub || !account) throw new Error("ログインしてください");
		if (sub.status !== "free") throw new Error("すでに契約中です");
		if (data.planId === "free") throw new Error("有料プランを選択してください");
		sub.planId = data.planId;
		if (!account.trialUsed) {
			account.trialUsed = true;
			sub.status = "trial";
			const end = new Date();
			end.setDate(end.getDate() + TRIAL_DAYS);
			sub.trialEndsAt = end.toISOString();
		} else {
			const plan = PLANS.find((item) => item.id === data.planId);
			const invoice = {
				id: crypto.randomUUID(),
				accountId: id as string,
				planId: data.planId,
				amount: plan?.monthlyPrice ?? 0,
				kind: "new" as const,
				status: "unpaid" as const,
				createdAt: new Date().toISOString(),
			};
			store.invoices.push(invoice);
			sub.status = "pending_payment";
			sub.pendingInvoiceId = invoice.id;
		}
	});

export function ApplyPage() {
	const navigate = useNavigate();
	const [data, setData] = useState<Awaited<
		ReturnType<typeof getApplyContext>
	> | null>(null);
	const [error, setError] = useState("");
	useEffect(() => {
		getApplyContext().then(setData);
	}, []);
	async function apply(planId: PlanId) {
		try {
			await applySubscription({ data: { planId } });
			await navigate({ to: "/subscription/edit" });
		} catch (e) {
			setError(e instanceof Error ? e.message : "申し込みに失敗しました");
		}
	}
	if (!data)
		return (
			<main className="demo-page">
				<section className="demo-panel">読み込み中...</section>
			</main>
		);
	if (!data.loggedIn)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					<h1 className="demo-title">サブスク申し込み</h1>
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
				{error && <p className="demo-alert demo-alert-danger">{error}</p>}
				{data.status !== "free" ? (
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
											? "請求が作成されます"
											: `${TRIAL_DAYS}日間の無料トライアルが始まります`}
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
