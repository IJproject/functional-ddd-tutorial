import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import { type FormEvent, useState } from "react";
import { auth } from "#/external/better-auth/auth";

type PlanId = "free" | "basic" | "pro";
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

const signup = createServerFn({ method: "POST" })
	.validator((d: unknown) => d as Record<"email" | "password" | "name", string>)
	.handler(async ({ data }) => {
		try {
			const result = await auth.api.signUpEmail({
				body: data,
				headers: getRequestHeaders(),
			});
			const id = result.user.id;
			store.accounts.push({
				id,
				billingAddress: "",
				paymentMethod: "",
				trialUsed: false,
				createdAt: new Date().toISOString(),
			});
			store.subscriptions.push({
				accountId: id,
				status: "free",
				planId: "free",
			});
		} catch (error) {
			if (
				error instanceof APIError &&
				(error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
					error.body?.code === "USER_ALREADY_EXISTS")
			) {
				throw new Error("そのメールアドレスは登録済みです");
			}
			throw new Error("登録に失敗しました");
		}
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
			await navigate({ to: "/subscription/edit" });
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
