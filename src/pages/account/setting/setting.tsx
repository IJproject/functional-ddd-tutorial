import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useEffect, useState } from "react";

type PlanId = "free" | "basic" | "pro";
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

const getAccount = createServerFn({ method: "GET" }).handler(async () => {
	const account = store.accounts.find(
		(item) => item.id === store.currentAccountId,
	);
	const subscription = store.subscriptions.find(
		(item) => item.accountId === store.currentAccountId,
	);
	return account && subscription
		? {
				loggedIn: true as const,
				account: {
					id: account.id,
					name: account.name,
					email: account.email,
					billingAddress: account.billingAddress,
					paymentMethod: account.paymentMethod,
				},
				status: subscription.status,
			}
		: { loggedIn: false as const };
});
const updateProfile = createServerFn({ method: "POST" })
	.validator(
		(d: unknown) =>
			d as {
				name: string;
				email: string;
				password?: string;
				billingAddress: string;
				paymentMethod: string;
			},
	)
	.handler(async ({ data }) => {
		const account = store.accounts.find(
			(item) => item.id === store.currentAccountId,
		);
		if (!account) throw new Error("ログインしてください");
		if (
			store.accounts.some(
				(item) => item.id !== account.id && item.email === data.email,
			)
		)
			throw new Error("そのメールアドレスは登録済みです");
		Object.assign(account, {
			name: data.name,
			email: data.email,
			billingAddress: data.billingAddress,
			paymentMethod: data.paymentMethod,
		});
		if (data.password) account.password = data.password;
	});
const withdraw = createServerFn({ method: "POST" }).handler(async () => {
	const id = store.currentAccountId;
	const sub = store.subscriptions.find((item) => item.accountId === id);
	if (!id || !sub) throw new Error("ログインしてください");
	if (sub.status !== "free")
		throw new Error(
			"有料サブスクリプション利用中は退会できません。先に解約して無料プランに戻してください",
		);
	store.accounts = store.accounts.filter((item) => item.id !== id);
	store.subscriptions = store.subscriptions.filter(
		(item) => item.accountId !== id,
	);
	store.invoices = store.invoices.filter((item) => item.accountId !== id);
	store.currentAccountId = null;
});

export function SettingPage() {
	const navigate = useNavigate();
	const [data, setData] = useState<Awaited<
		ReturnType<typeof getAccount>
	> | null>(null);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	useEffect(() => {
		getAccount().then(setData);
	}, []);
	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await updateProfile({
				data: {
					name: String(form.get("name")),
					email: String(form.get("email")),
					password: String(form.get("password")),
					billingAddress: String(form.get("billingAddress")),
					paymentMethod: String(form.get("paymentMethod")),
				},
			});
			setMessage("保存しました");
		} catch (e) {
			setError(e instanceof Error ? e.message : "保存に失敗しました");
		}
	}
	async function leave() {
		try {
			await withdraw();
			await navigate({ to: "/" });
		} catch (e) {
			setError(e instanceof Error ? e.message : "退会できません");
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
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">アカウント</p>
				<h1 className="demo-title">アカウント設定</h1>
				{error && <p className="demo-alert demo-alert-danger">{error}</p>}
				{message && <p className="demo-alert">{message}</p>}
				<form onSubmit={save} className="space-y-4">
					<label className="block">
						名前
						<input
							name="name"
							defaultValue={data.account.name}
							required
							className="demo-input mt-1 w-full"
						/>
					</label>
					<label className="block">
						メールアドレス
						<input
							name="email"
							type="email"
							defaultValue={data.account.email}
							required
							className="demo-input mt-1 w-full"
						/>
					</label>
					<label className="block">
						新しいパスワード
						<input
							name="password"
							type="password"
							minLength={8}
							className="demo-input mt-1 w-full"
						/>
					</label>
					<label className="block">
						請求先情報
						<input
							name="billingAddress"
							defaultValue={data.account.billingAddress}
							className="demo-input mt-1 w-full"
						/>
					</label>
					<label className="block">
						支払い方法
						<input
							name="paymentMethod"
							defaultValue={data.account.paymentMethod}
							className="demo-input mt-1 w-full"
						/>
					</label>
					<button className="demo-button" type="submit">
						保存
					</button>
				</form>
				<hr className="my-8" />
				<h2 className="demo-title text-xl">退会</h2>
				{data.status !== "free" && (
					<p className="demo-muted">
						有料サブスクリプション利用中は退会できません。先に解約して無料プランに戻してください。
					</p>
				)}
				<button
					type="button"
					className="demo-button-danger"
					disabled={data.status !== "free"}
					onClick={leave}
				>
					退会する
				</button>
			</section>
		</main>
	);
}
