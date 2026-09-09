import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

type PlanId = "free" | "basic" | "pro";
const PLANS = [
	{ id: "free", name: "無料プラン", monthlyPrice: 0 },
	{ id: "basic", name: "ベーシック", monthlyPrice: 980 },
	{ id: "pro", name: "プロ", monthlyPrice: 2980 },
] as const;
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

const getPlanChangeContext = createServerFn({ method: "GET" }).handler(
	async () => {
		const sub = store.subscriptions.find(
			(item) => item.accountId === store.currentAccountId,
		);
		return sub
			? {
					loggedIn: true as const,
					subscription: sub,
					plans: PLANS.filter((plan) => plan.id !== "free"),
				}
			: { loggedIn: false as const };
	},
);
const requestPlanChange = createServerFn({ method: "POST" })
	.validator((d: unknown) => d as { planId: PlanId })
	.handler(async ({ data }) => {
		const sub = store.subscriptions.find(
			(item) => item.accountId === store.currentAccountId,
		);
		if (!sub) throw new Error("ログインしてください");
		if (sub.status === "free")
			throw new Error("先にサブスクを申し込んでください");
		if (sub.status === "pending_payment" || data.planId === sub.planId)
			throw new Error("このプランには変更できません");
		if (sub.pendingInvoiceId)
			throw new Error("支払い待ちの請求があります。先に支払ってください");
		if (sub.reservation)
			throw new Error("すでに解約またはプラン変更の予約があります");
		const current =
			PLANS.find((plan) => plan.id === sub.planId)?.monthlyPrice ?? 0;
		const next =
			PLANS.find((plan) => plan.id === data.planId)?.monthlyPrice ?? 0;
		if (sub.status === "trial") {
			const invoice = {
				id: crypto.randomUUID(),
				accountId: store.currentAccountId as string,
				planId: data.planId,
				amount: next,
				kind: "new" as const,
				status: "unpaid" as const,
				createdAt: new Date().toISOString(),
			};
			store.invoices.push(invoice);
			sub.status = "pending_payment";
			sub.pendingInvoiceId = invoice.id;
			delete sub.trialEndsAt;
		} else if (next > current) {
			const invoice = {
				id: crypto.randomUUID(),
				accountId: store.currentAccountId as string,
				planId: data.planId,
				amount: next - current,
				kind: "upgrade_diff" as const,
				status: "unpaid" as const,
				createdAt: new Date().toISOString(),
			};
			store.invoices.push(invoice);
			sub.pendingInvoiceId = invoice.id;
		} else {
			sub.reservation = { kind: "change_plan", planId: data.planId };
		}
	});

export function EditPage() {
	const navigate = useNavigate();
	const [data, setData] = useState<Awaited<
		ReturnType<typeof getPlanChangeContext>
	> | null>(null);
	const [error, setError] = useState("");
	useEffect(() => {
		getPlanChangeContext().then(setData);
	}, []);
	async function change(planId: PlanId) {
		try {
			await requestPlanChange({ data: { planId } });
			await navigate({ to: "/billing/list" });
		} catch (e) {
			setError(e instanceof Error ? e.message : "変更に失敗しました");
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
					<p>ログインしてください。</p>
					<Link to="/auth/login">ログインへ</Link>
				</section>
			</main>
		);
	const sub = data.subscription as Subscription;
	const current = PLANS.find((plan) => plan.id === sub.planId);
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">サブスクリプション</p>
				<h1 className="demo-title">プランを変更</h1>
				{error && <p className="demo-alert demo-alert-danger">{error}</p>}
				{sub.status === "free" ? (
					<>
						<p>先にサブスクを申し込んでください。</p>
						<Link to="/subscription/apply">申し込みへ</Link>
					</>
				) : (
					<>
						<p>
							現在のプラン: <strong>{current?.name}</strong>（{sub.status}）
						</p>
						<div className="space-y-3">
							{data.plans.map((plan) => {
								const diff = plan.monthlyPrice - (current?.monthlyPrice ?? 0);
								return (
									<article
										className="demo-card flex items-center justify-between"
										key={plan.id}
									>
										<div>
											<strong>{plan.name}</strong>
											<p className="demo-muted">
												{sub.status === "trial"
													? "トライアル終了→請求"
													: diff > 0
														? `アップグレード（差額 ¥${diff.toLocaleString()} の請求）`
														: "ダウングレード（期間満了時に切替）"}
											</p>
										</div>
										<button
											type="button"
											className="demo-button"
											disabled={plan.id === sub.planId}
											onClick={() => change(plan.id)}
										>
											変更する
										</button>
									</article>
								);
							})}
						</div>
					</>
				)}
			</section>
		</main>
	);
}
