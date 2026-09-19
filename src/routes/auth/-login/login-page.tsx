import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";
import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
import { TextField } from "#/components/form/text-field";
import {
	decodeLoginCommand,
	encodeLoginResponse,
	type LoginFieldError,
	loginCommandSchema,
	UNEXPECTED_LOGIN_RESPONSE,
} from "#/domain/auth/dto/login.dto";
import { LoggedInAt } from "#/domain/auth/model/login.primitive";
import {
	createLoggedInEvent,
	createLoginWorkflow,
	validateLoginRequest,
} from "#/domain/auth/workflow/login.workflow";
import { verifyCredentials } from "#/external/better-auth/verify-credentials";

// composition root: ドメインのポートに具体的な実装を差し込むのはここだけ。
const loginWorkflow = createLoginWorkflow({
	validateLoginRequest,
	verifyCredentials,
	createLoggedInEvent,
	now: () => LoggedInAt.create(new Date()),
});

const login = createServerFn({ method: "POST" })
	.validator(loginCommandSchema)
	.handler(async ({ data }) =>
		encodeLoginResponse(await loginWorkflow(decodeLoginCommand(data))),
	);

export function LoginPage() {
	const navigate = useNavigate();
	const router = useRouter();
	const [errors, setErrors] = useState<LoginFieldError[]>([]);

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
			await router.invalidate();
			await navigate({ to: "/" });
		} catch {
			// ここに来るのは通信断や、アダプタが投げ直したインフラ障害だけ。
			setErrors(UNEXPECTED_LOGIN_RESPONSE.errors);
		}
	}
	return (
		<main className="demo-page is-narrow">
			<section className="demo-panel">
				<h1 className="demo-title">アカウントにログイン</h1>
				<Alert messages={formErrors.map((item) => item.message)} />
				<form onSubmit={submit} className="space-y-4">
					<TextField
						label="メールアドレス"
						name="email"
						type="email"
						required
						errors={emailErrors.map((item) => item.message)}
					/>
					<TextField
						label="パスワード"
						name="password"
						type="password"
						required
						errors={passwordErrors.map((item) => item.message)}
					/>
					<Button kind="submit" className="w-full">
						ログイン
					</Button>
				</form>
				<p className="demo-muted mt-6">
					アカウントがない場合は <Link to="/auth/signup">新規登録</Link>
				</p>
			</section>
		</main>
	);
}
