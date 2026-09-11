import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import { type FormEvent, useEffect, useState } from "react";
import { auth } from "#/external/better-auth/auth";

const currentUserId = async () => {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	return session?.user.id ?? null;
};

const login = createServerFn({ method: "POST" })
	.validator((d: unknown) => d as Record<"email" | "password", string>)
	.handler(async ({ data }) => {
		try {
			await auth.api.signInEmail({
				body: data,
				headers: getRequestHeaders(),
			});
		} catch (error) {
			if (error instanceof APIError)
				throw new Error("メールアドレスまたはパスワードが違います");
			throw error;
		}
	});
const logout = createServerFn({ method: "POST" }).handler(async () => {
	await auth.api.signOut({ headers: getRequestHeaders() });
});
const getLoginState = createServerFn({ method: "GET" }).handler(async () => ({
	loggedIn: (await currentUserId()) !== null,
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
			await navigate({ to: "/subscription/edit" });
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
