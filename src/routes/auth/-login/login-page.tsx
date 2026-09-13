import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useEffect, useState } from "react";
import {
	decodeLoginCommand,
	encodeLoginResponse,
	encodeSessionView,
	type LoginFieldError,
	loginCommandSchema,
	type SessionView,
} from "#/domain/auth/dto/login.dto";
import { encodeLogoutResponse } from "#/domain/auth/dto/logout.dto";
import { LoggedInAt } from "#/domain/auth/model/login.primitive";
import { LoggedOutAt } from "#/domain/auth/model/logout.primitive";
import {
	createLoggedInEvent,
	createLoginWorkflow,
	validateLoginRequest,
} from "#/domain/auth/workflow/login.workflow";
import {
	createLoggedOutEvent,
	createLogoutWorkflow,
} from "#/domain/auth/workflow/logout.workflow";
import { currentSession } from "#/external/better-auth/current-session";
import { discardSession } from "#/external/better-auth/discard-session";
import { verifyCredentials } from "#/external/better-auth/verify-credentials";

// composition root: ドメインのポートに具体的な実装を差し込むのはここだけ。
const loginWorkflow = createLoginWorkflow({
	validateLoginRequest,
	verifyCredentials,
	createLoggedInEvent,
	now: () => LoggedInAt.create(new Date()),
});

const logoutWorkflow = createLogoutWorkflow({
	discardSession,
	createLoggedOutEvent,
	now: () => LoggedOutAt.create(new Date()),
});

const login = createServerFn({ method: "POST" })
	.validator(loginCommandSchema)
	.handler(async ({ data }) =>
		encodeLoginResponse(await loginWorkflow(decodeLoginCommand(data))),
	);
const logout = createServerFn({ method: "POST" }).handler(async () =>
	encodeLogoutResponse(await logoutWorkflow(await currentSession())),
);

const fetchSession = createServerFn({ method: "GET" }).handler(async () =>
	encodeSessionView(await currentSession()),
);

// ワークフロー外の失敗に対する文言。ドメインが想定していない失敗なので、
// 捕まえた例外の中身は表示せずに一律の表現へ落とす（内部情報を漏らさないため）。
const UNEXPECTED_LOGIN_ERROR: LoginFieldError = {
	field: null,
	message: "ログインに失敗しました",
};
const UNEXPECTED_LOGOUT_ERROR: LoginFieldError = {
	field: null,
	message: "ログアウトに失敗しました",
};
const UNEXPECTED_SESSION_ERROR: LoginFieldError = {
	field: null,
	message: "セッションの取得に失敗しました",
};

export function LoginPage() {
	const navigate = useNavigate();
	const [errors, setErrors] = useState<LoginFieldError[]>([]);
	const [session, setSession] = useState<SessionView>({ loggedIn: false });
	useEffect(() => {
		fetchSession()
			.then(setSession)
			// 取得できなければ未ログイン扱いのままフォームを出す。黙って握り潰さず理由は見せる。
			.catch(() => setErrors([UNEXPECTED_SESSION_ERROR]));
	}, []);

	/** field ごとの振り分け。field: null はフォーム全体のエラー。 */
	const errorsFor = (field: LoginFieldError["field"]) =>
		errors.filter((item) => item.field === field);
	const formErrors = errorsFor(null);
	const emailErrors = errorsFor("email");
	const passwordErrors = errorsFor("password");
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			const result = await login({
				data: {
					email: String(form.get("email")),
					password: String(form.get("password")),
				},
			});
			if (!result.ok) {
				setErrors(result.errors);
				return;
			}
			setErrors([]);
			await navigate({ to: "/subscription/edit" });
		} catch {
			// ここに来るのは通信断や、アダプタが投げ直したインフラ障害だけ。
			setErrors([UNEXPECTED_LOGIN_ERROR]);
		}
	}
	async function signout() {
		try {
			const result = await logout();
			setSession({ loggedIn: false });
			setErrors(result.ok ? [] : [{ field: null, message: result.message }]);
		} catch {
			// 破棄できたかどうか分からないので session は触らず、エラーだけ出す。
			setErrors([UNEXPECTED_LOGOUT_ERROR]);
		}
	}
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">ログイン</p>
				<h1 className="demo-title">アカウントにログイン</h1>
				{formErrors.length > 0 && (
					<div className="demo-alert demo-alert-danger">
						{formErrors.map((item) => (
							<p key={item.message}>{item.message}</p>
						))}
					</div>
				)}
				{session.loggedIn ? (
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
								aria-invalid={emailErrors.length > 0}
								aria-describedby={
									emailErrors.length > 0 ? "email-error" : undefined
								}
							/>
							{emailErrors.length > 0 && (
								<span id="email-error" className="demo-field-error">
									{emailErrors.map((item) => item.message).join(" / ")}
								</span>
							)}
						</label>
						<label className="block">
							パスワード
							<input
								name="password"
								type="password"
								required
								className="demo-input mt-1 w-full"
								aria-invalid={passwordErrors.length > 0}
								aria-describedby={
									passwordErrors.length > 0 ? "password-error" : undefined
								}
							/>
							{passwordErrors.length > 0 && (
								<span id="password-error" className="demo-field-error">
									{passwordErrors.map((item) => item.message).join(" / ")}
								</span>
							)}
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
