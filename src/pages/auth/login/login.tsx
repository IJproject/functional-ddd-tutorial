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

const login = createServerFn({ method: "POST" })
	.validator((d: unknown) => d as { email: string; password: string })
	.handler(async ({ data }) => {
		const account = store.accounts.find(
			(item) => item.email === data.email && item.password === data.password,
		);
		if (!account) throw new Error("メールアドレスまたはパスワードが違います");
		store.currentAccountId = account.id;
	});
const logout = createServerFn({ method: "POST" }).handler(async () => {
	store.currentAccountId = null;
});
const getLoginState = createServerFn({ method: "GET" }).handler(async () => ({
	loggedIn: store.currentAccountId !== null,
}));

export function LoginPage() {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [loggedIn, setLoggedIn] = useState(false);
	useEffect(() => {
		getLoginState().then((result) => setLoggedIn(result.loggedIn));
	}, []);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await login({
				data: {
					email: String(form.get("email")),
					password: String(form.get("password")),
				},
			});
			await navigate({ to: "/billing/list" });
		} catch (e) {
			setError(e instanceof Error ? e.message : "ログインに失敗しました");
		}
	}
	async function signout() {
		await logout();
		setLoggedIn(false);
	}
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">ログイン</p>
				<h1 className="demo-title">アカウントにログイン</h1>
				{error && <p className="demo-alert demo-alert-danger">{error}</p>}
				{loggedIn ? (
					<button
						type="button"
						className="demo-button-danger"
						onClick={signout}
					>
						ログアウト
					</button>
				) : (
					<form onSubmit={submit} className="space-y-4">
						<label className="block">
							メールアドレス
							<input
								name="email"
								type="email"
								required
								className="demo-input mt-1 w-full"
							/>
						</label>
						<label className="block">
							パスワード
							<input
								name="password"
								type="password"
								required
								className="demo-input mt-1 w-full"
							/>
						</label>
						<button className="demo-button" type="submit">
							ログイン
						</button>
					</form>
				)}
				<p className="demo-muted mt-6">
					アカウントがない場合は <Link to="/auth/signup">新規登録</Link>
				</p>
			</section>
		</main>
	);
}
