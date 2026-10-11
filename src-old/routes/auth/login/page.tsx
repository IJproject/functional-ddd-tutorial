import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";
import { login as loginAction } from "#/application/auth/login";
import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
import { TextField } from "#/components/form/text-field";
import {
	type LoginFieldError,
	LoginRequest,
	LoginResponse,
} from "#/domain/auth/operation/login/login.dto";

const login = createServerFn({ method: "POST" })
	.validator(LoginRequest.schema)
	.handler(async ({ data }) => loginAction(data));

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
			setErrors(LoginResponse.unexpected.errors);
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
