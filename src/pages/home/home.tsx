import { Link } from "@tanstack/react-router";
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

const getHome = createServerFn({ method: "GET" }).handler(async () => {
	const account = store.accounts.find(
		(item) => item.id === store.currentAccountId,
	);
	const subscription = store.subscriptions.find(
		(item) => item.accountId === store.currentAccountId,
	);
	if (!account || !subscription) return { loggedIn: false as const };
	return {
		loggedIn: true as const,
		email: account.email,
		name: account.name,
		status: subscription.status,
		planName: PLANS.find((plan) => plan.id === subscription.planId)?.name ?? "",
	};
});

export function HomePage() {
	const [data, setData] = useState<Awaited<ReturnType<typeof getHome>> | null>(
		null,
	);
	useEffect(() => {
		getHome().then(setData);
	}, []);
	return (
		<main className="page-wrap px-4 pb-8 pt-14">
			<section className="island-shell rounded-[2rem] px-6 py-10 sm:px-10">
				<p className="island-kicker">Subscription management</p>
				<h1 className="display-title mb-5 text-4xl font-bold">
					サブスク管理をシンプルに。
				</h1>
				{data?.loggedIn ? (
					<>
						<p>{data.name}さん</p>
						<p className="demo-muted">
							現在: {data.planName}（{data.status}）
						</p>
						<Link className="demo-button mt-6 inline-block" to="/billing/list">
							請求・契約状況を見る
						</Link>
					</>
				) : (
					<>
						<p className="demo-muted">
							サブスクリプションの申し込み、変更、請求をまとめて管理できます。
						</p>
						<div className="mt-6 flex gap-3">
							<Link className="demo-button" to="/auth/signup">
								アカウント登録
							</Link>
							<Link className="demo-button-secondary" to="/auth/login">
								ログイン
							</Link>
						</div>
					</>
				)}
			</section>
		</main>
	);
}
