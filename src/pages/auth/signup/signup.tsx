import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";

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

const signup = createServerFn({ method: "POST" })
	.validator(
		(d: unknown) => d as { email: string; password: string; name: string },
	)
	.handler(async ({ data }) => {
		if (store.accounts.some((account) => account.email === data.email))
			throw new Error("そのメールアドレスは登録済みです");
		const id = crypto.randomUUID();
		store.accounts.push({
			id,
			email: data.email,
			password: data.password,
			name: data.name,
			billingAddress: "",
			paymentMethod: "",
			trialUsed: false,
			createdAt: new Date().toISOString(),
		});
		store.subscriptions.push({ accountId: id, status: "free", planId: "free" });
		store.currentAccountId = id;
	});

export function SignupPage() {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await signup({
				data: {
					name: String(form.get("name")),
					email: String(form.get("email")),
					password: String(form.get("password")),
				},
			});
			await navigate({ to: "/billing/list" });
		} catch (e) {
			setError(e instanceof Error ? e.message : "登録に失敗しました");
		}
	}
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">アカウント登録</p>
				<h1 className="demo-title">Subsc Tutorial を始める</h1>
				{error && <p className="demo-alert demo-alert-danger">{error}</p>}
				<form onSubmit={submit} className="space-y-4">
					<label className="block">
						名前
						<input name="name" required className="demo-input mt-1 w-full" />
					</label>
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
							minLength={8}
							required
							className="demo-input mt-1 w-full"
						/>
					</label>
					<button className="demo-button" type="submit">
						登録する
					</button>
				</form>
				<p className="demo-muted mt-6">
					すでに登録済みですか？ <Link to="/auth/login">ログイン</Link>
				</p>
			</section>
		</main>
	);
}
