import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useEffect, useState } from "react";
import {
	type LoginErrorDto,
	loginInputSchema,
	type SessionDto,
	toLoginOutputDto,
	toSessionDto,
	toUnvalidatedLoginRequest,
} from "#/domain/auth/dto/login.dto";
import { toLogoutOutputDto } from "#/domain/auth/dto/logout.dto";
import { toLoggedInAt } from "#/domain/auth/model/login.primitive";
import { toLoggedOutAt } from "#/domain/auth/model/logout.primitive";
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
	now: () => toLoggedInAt(new Date()),
});

const logoutWorkflow = createLogoutWorkflow({
	discardSession,
	createLoggedOutEvent,
	now: () => toLoggedOutAt(new Date()),
});

const login = createServerFn({ method: "POST" })
	.validator(loginInputSchema)
	.handler(async ({ data }) =>
		toLoginOutputDto(await loginWorkflow(toUnvalidatedLoginRequest(data))),
	);
const logout = createServerFn({ method: "POST" }).handler(async () =>
	toLogoutOutputDto(await logoutWorkflow(await currentSession())),
);

const fetchSession = createServerFn({ method: "GET" }).handler(async () =>
	toSessionDto(await currentSession()),
);

const UNEXPECTED_ERROR: LoginErrorDto = {
	field: null,
	message: "ログインに失敗しました",
};

export function LoginPage() {
	const navigate = useNavigate();
	const [errors, setErrors] = useState<LoginErrorDto[]>([]);
	const [session, setSession] = useState<SessionDto>({ loggedIn: false });
	useEffect(() => {
		fetchSession().then(setSession);
	}, []);
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
			// ここに来るのは通信断などワークフロー外の失敗だけ。
			setErrors([UNEXPECTED_ERROR]);
		}
	}
	async function signout() {
		const result = await logout();
		setSession({ loggedIn: false });
		setErrors(result.ok ? [] : [{ field: null, message: result.message }]);
	}
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">ログイン</p>
				<h1 className="demo-title">アカウントにログイン</h1>
				{errors.length > 0 && (
					<div className="demo-alert demo-alert-danger">
						{errors.map((item) => (
							<p key={`${item.field ?? "form"}:${item.message}`}>
								{item.message}
							</p>
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
