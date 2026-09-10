import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { useCallback, useEffect, useState } from "react";
import { auth } from "#/external/better-auth/auth";

type PlanId = "free" | "basic" | "pro";
const PLANS = [
	{ id: "free", name: "無料プラン", monthlyPrice: 0 },
	{ id: "basic", name: "ベーシック", monthlyPrice: 980 },
	{ id: "pro", name: "プロ", monthlyPrice: 2980 },
] as const;
type Account = {
	id: string;
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
};
const globalStore = globalThis as { __subscStore?: Store };
globalStore.__subscStore ??= {
	accounts: [],
	subscriptions: [],
	invoices: [],
};
const store: Store = globalStore.__subscStore;

const currentUserId = async () => {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	return session?.user.id ?? null;
};
const ensureStoreRecords = (id: string) => {
	if (!store.accounts.some((item) => item.id === id)) {
		store.accounts.push({
			id,
			billingAddress: "",
			paymentMethod: "",
			trialUsed: false,
			createdAt: new Date().toISOString(),
		});
	}
	if (!store.subscriptions.some((item) => item.accountId === id)) {
		store.subscriptions.push({ accountId: id, status: "free", planId: "free" });
	}
};
const getSubscription = createServerFn({ method: "GET" }).handler(async () => {
	const id = await currentUserId();
	if (!id) return { loggedIn: false as const };
	ensureStoreRecords(id);
	const subscription = store.subscriptions.find(
		(item) => item.accountId === id,
	);
	if (!subscription) return { loggedIn: false as const };
	return {
		loggedIn: true as const,
		subscription,
		planName: PLANS.find((plan) => plan.id === subscription.planId)?.name,
		trialUsed: store.accounts.find((item) => item.id === id)?.trialUsed,
		plans: PLANS.filter((plan) => plan.id !== "free"),
		invoices: store.invoices
			.filter((item) => item.accountId === id)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
	};
});
const requestPlanChange = createServerFn({ method: "POST" })
	.validator((d: unknown) => d as { planId: PlanId })
	.handler(async ({ data }) => {
		const id = await currentUserId();
		if (!id) throw new Error("ログインしてください");
		const sub = store.subscriptions.find((item) => item.accountId === id);
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
				accountId: id,
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
				accountId: id,
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
const cancelTrial = createServerFn({ method: "POST" }).handler(async () => {
	const id = await currentUserId();
	if (!id) throw new Error("ログインしてください");
	const sub = store.subscriptions.find((item) => item.accountId === id);
	if (!sub || sub.status !== "trial")
		throw new Error("トライアル中ではありません");
	sub.status = "free";
	sub.planId = "free";
	delete sub.trialEndsAt;
});
const reserveCancellation = createServerFn({ method: "POST" }).handler(
	async () => {
		const id = await currentUserId();
		if (!id) throw new Error("ログインしてください");
		const sub = store.subscriptions.find((item) => item.accountId === id);
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
		const id = await currentUserId();
		if (!id) throw new Error("ログインしてください");
		const invoice = store.invoices.find(
			(item) => item.id === data.invoiceId && item.accountId === id,
		);
		const sub = store.subscriptions.find((item) => item.accountId === id);
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
		const id = await currentUserId();
		if (!id) throw new Error("ログインしてください");
		const sub = store.subscriptions.find((item) => item.accountId === id);
		if (!sub || sub.status !== "trial")
			throw new Error("トライアル中ではありません");
		const plan = PLANS.find((item) => item.id === sub.planId);
		const invoice: Invoice = {
			id: crypto.randomUUID(),
			accountId: id,
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
		const id = await currentUserId();
		if (!id) throw new Error("ログインしてください");
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
			accountId: id,
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

export function EditPage() {
	const [data, setData] = useState<Awaited<
		ReturnType<typeof getSubscription>
	> | null>(null);
	const [error, setError] = useState("");
	const reload = useCallback(
		() =>
			getSubscription()
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
	async function change(planId: PlanId) {
		await act(() => requestPlanChange({ data: { planId } }));
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
	const label = (id: PlanId) =>
		PLANS.find((plan) => plan.id === id)?.name ?? id;
	const date = (value?: string) =>
		value ? new Date(value).toLocaleString("ja-JP") : "";
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">サブスクリプション</p>
				<h1 className="demo-title">契約</h1>
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
						)}
					</>
				)}
			</section>
			<section className="demo-panel">
				<h2 className="demo-title">プラン変更</h2>
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
				他の画面へ: <Link to="/subscription/apply">申し込み</Link>
			</p>
		</main>
	);
}
