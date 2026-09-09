import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

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

const accountId = () => {
	if (!store.currentAccountId) return null;
	return store.currentAccountId;
};
const getBilling = createServerFn({ method: "GET" }).handler(async () => {
	const id = accountId();
	if (!id) return { loggedIn: false as const };
	const subscription = store.subscriptions.find(
		(item) => item.accountId === id,
	);
	return {
		loggedIn: true as const,
		subscription,
		planName: PLANS.find((plan) => plan.id === subscription?.planId)?.name,
		trialUsed: store.accounts.find((item) => item.id === id)?.trialUsed,
		invoices: store.invoices
			.filter((item) => item.accountId === id)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
	};
});
const cancelTrial = createServerFn({ method: "POST" }).handler(async () => {
	const id = accountId();
	const sub = store.subscriptions.find((item) => item.accountId === id);
	if (!sub || sub.status !== "trial")
		throw new Error("トライアル中ではありません");
	sub.status = "free";
	sub.planId = "free";
	delete sub.trialEndsAt;
});
const reserveCancellation = createServerFn({ method: "POST" }).handler(
	async () => {
		const sub = store.subscriptions.find(
			(item) => item.accountId === accountId(),
		);
		if (!sub || sub.status !== "paid")
			throw new Error("有料契約中ではありません");
		sub.reservation = { kind: "cancel" };
	},
);
const payInvoice = createServerFn({ method: "POST" })
	.validator(
		(d: unknown) => d as { invoiceId: string; result: "success" | "failure" },
	)
	.handler(async ({ data }) => {
		const invoice = store.invoices.find(
			(item) => item.id === data.invoiceId && item.accountId === accountId(),
		);
		const sub = store.subscriptions.find(
			(item) => item.accountId === accountId(),
		);
		if (!invoice || !sub) throw new Error("請求が見つかりません");
		if (invoice.status !== "unpaid")
			throw new Error("この請求はすでに処理済みです");
		invoice.status = data.result === "success" ? "paid" : "failed";
		delete sub.pendingInvoiceId;
		if (data.result === "success") {
			sub.planId = invoice.planId;
			if (invoice.kind !== "upgrade_diff") {
				sub.status = "paid";
				const end = new Date();
				end.setMonth(end.getMonth() + 1);
				sub.periodEndsAt = end.toISOString();
			}
		} else if (invoice.kind !== "upgrade_diff") {
			sub.status = "free";
			sub.planId = "free";
			delete sub.periodEndsAt;
		}
	});
const simulateTrialEnd = createServerFn({ method: "POST" }).handler(
	async () => {
		const id = accountId();
		const sub = store.subscriptions.find((item) => item.accountId === id);
		if (!sub || sub.status !== "trial")
			throw new Error("トライアル中ではありません");
		const plan = PLANS.find((item) => item.id === sub.planId);
		const invoice: Invoice = {
			id: crypto.randomUUID(),
			accountId: id as string,
			planId: sub.planId,
			amount: plan?.monthlyPrice ?? 0,
			kind: "new",
			status: "unpaid",
			createdAt: new Date().toISOString(),
		};
		store.invoices.push(invoice);
		sub.status = "pending_payment";
		sub.pendingInvoiceId = invoice.id;
		delete sub.trialEndsAt;
	},
);
const simulatePeriodEnd = createServerFn({ method: "POST" }).handler(
	async () => {
		const id = accountId();
		const sub = store.subscriptions.find((item) => item.accountId === id);
		if (!sub || sub.status !== "paid")
			throw new Error("有料契約中ではありません");
		if (sub.reservation?.kind === "cancel") {
			sub.status = "free";
			sub.planId = "free";
			delete sub.reservation;
			delete sub.periodEndsAt;
			return;
		}
		if (sub.reservation?.kind === "change_plan") {
			sub.planId = sub.reservation.planId;
		}
		const planId = sub.planId;
		const plan = PLANS.find((item) => item.id === planId);
		const invoice: Invoice = {
			id: crypto.randomUUID(),
			accountId: id as string,
			planId,
			amount: plan?.monthlyPrice ?? 0,
			kind: "renewal",
			status: "unpaid",
			createdAt: new Date().toISOString(),
		};
		store.invoices.push(invoice);
		sub.status = "pending_payment";
		sub.pendingInvoiceId = invoice.id;
		delete sub.reservation;
	},
);

export function BillingPage() {
	const [data, setData] = useState<Awaited<
		ReturnType<typeof getBilling>
	> | null>(null);
	const [error, setError] = useState("");
	const reload = useCallback(
		() =>
			getBilling()
				.then(setData)
				.catch((e) =>
					setError(e instanceof Error ? e.message : "エラーが発生しました"),
				),
		[],
	);
	useEffect(() => {
		reload();
	}, [reload]);
	async function act(action: () => Promise<unknown>) {
		try {
			setError("");
			await action();
			reload();
		} catch (e) {
			setError(e instanceof Error ? e.message : "操作に失敗しました");
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
					<h1 className="demo-title">請求・契約状況</h1>
					<p>ログインしてください。</p>
					<Link to="/auth/login">ログインへ</Link>
				</section>
			</main>
		);
	const sub = data.subscription as Subscription;
	const label = (id: PlanId) =>
		PLANS.find((plan) => plan.id === id)?.name ?? id;
	const date = (value?: string) =>
		value ? new Date(value).toLocaleString("ja-JP") : "";
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">契約状況</p>
				<h1 className="demo-title">現在の契約</h1>
				{error && <p className="demo-alert demo-alert-danger">{error}</p>}
				<p>
					<strong>{data.planName}</strong>（{sub.status}）
				</p>
				{sub.status === "free" && (
					<>
						<p>無料プラン利用中</p>
						<Link to="/subscription/apply">サブスクを申し込む</Link>
					</>
				)}
				{sub.status === "trial" && (
					<>
						<p>トライアル終了日: {date(sub.trialEndsAt)}</p>
						<button
							type="button"
							className="demo-button-danger"
							onClick={() => act(cancelTrial)}
						>
							トライアルを解約する
						</button>
					</>
				)}
				{sub.status === "pending_payment" && (
					<p>支払い待ちの請求があります。下の一覧から支払ってください。</p>
				)}
				{sub.status === "paid" && (
					<>
						<p>期間満了日: {date(sub.periodEndsAt)}</p>
						<p>
							{sub.reservation?.kind === "cancel"
								? "解約を予約中"
								: sub.reservation?.kind === "change_plan"
									? `${label(sub.reservation.planId)}へ期間満了時に変更予約中`
									: "予約なし"}
						</p>
						{sub.reservation?.kind !== "cancel" && (
							<button
								type="button"
								className="demo-button-danger"
								onClick={() => act(reserveCancellation)}
							>
								解約を予約する
							</button>
						)}{" "}
						<Link className="ml-4" to="/subscription/edit">
							プラン変更
						</Link>
					</>
				)}
			</section>
			<section className="demo-panel">
				<h2 className="demo-title">請求一覧</h2>
				<p className="demo-muted">
					決済サービスの代わりに手動で結果を入れます。
				</p>
				<div className="space-y-3">
					{data.invoices.map((invoice) => (
						<article className="demo-card" key={invoice.id}>
							<p>
								{invoice.kind} / {label(invoice.planId)} / ¥
								{invoice.amount.toLocaleString()} / {invoice.status}
							</p>
							<p className="demo-muted text-sm">{date(invoice.createdAt)}</p>
							{invoice.status === "unpaid" && (
								<div className="flex gap-2">
									<button
										type="button"
										className="demo-button"
										onClick={() =>
											act(() =>
												payInvoice({
													data: { invoiceId: invoice.id, result: "success" },
												}),
											)
										}
									>
										（模擬）支払い成功
									</button>
									<button
										type="button"
										className="demo-button-danger"
										onClick={() =>
											act(() =>
												payInvoice({
													data: { invoiceId: invoice.id, result: "failure" },
												}),
											)
										}
									>
										（模擬）支払い失敗
									</button>
								</div>
							)}
						</article>
					))}
					{data.invoices.length === 0 && (
						<p className="demo-muted">請求はありません。</p>
					)}
				</div>
			</section>
			<section className="demo-panel">
				<h2 className="demo-title">開発用シミュレーション</h2>
				<button
					type="button"
					className="demo-button-secondary mr-2"
					disabled={sub.status !== "trial"}
					onClick={() => act(simulateTrialEnd)}
				>
					（模擬）トライアル終了日を迎える
				</button>
				<button
					type="button"
					className="demo-button-secondary"
					disabled={sub.status !== "paid"}
					onClick={() => act(simulatePeriodEnd)}
				>
					（模擬）期間満了日を迎える
				</button>
			</section>
			<p className="demo-muted">
				他の画面へ: <Link to="/subscription/apply">申し込み</Link> /{" "}
				<Link to="/subscription/edit">プラン変更</Link> /{" "}
				<Link to="/account/setting">アカウント設定</Link>
			</p>
		</main>
	);
}
