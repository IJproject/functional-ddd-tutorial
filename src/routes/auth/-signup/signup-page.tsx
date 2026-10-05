import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";
import { signup as signupAction } from "#/application/auth/signup";
import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
import { TextField } from "#/components/form/text-field";
import {
	type SignupFieldError,
	SignupRequest,
	SignupResponse,
} from "#/domain/auth/operation/signup/signup.dto";

const signup = createServerFn({ method: "POST" })
	.validator(SignupRequest.schema)
	.handler(async ({ data }) => signupAction(data));
export function SignupPage() {
	const navigate = useNavigate();
	const router = useRouter();
	const [errors, setErrors] = useState<SignupFieldError[]>([]);

	/** field ごとの振り分け。field: null はフォーム全体のエラー。 */
	const errorsFor = (field: SignupFieldError["field"]) =>
		errors.filter((item) => item.field === field);
	const formErrors = errorsFor(null);
	const nameErrors = errorsFor("name");
	const emailErrors = errorsFor("email");
	const passwordErrors = errorsFor("password");
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			const result = await signup({
				data: {
					name: String(form.get("name")),
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
			setErrors(SignupResponse.unexpected.errors);
		}
	}
	return (
		<main className="demo-page is-narrow">
			<section className="demo-panel">
				<h1 className="demo-title">Subsc Tutorial を始める</h1>
				<Alert messages={formErrors.map((item) => item.message)} />
				<form onSubmit={submit} className="space-y-4">
					<TextField
						label="名前"
						name="name"
						required
						errors={nameErrors.map((item) => item.message)}
					/>
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
						minLength={8}
						required
						errors={passwordErrors.map((item) => item.message)}
					/>
					<Button kind="submit" className="w-full">
						登録する
					</Button>
				</form>
				<p className="demo-muted mt-6">
					すでに登録済みですか？ <Link to="/auth/login">ログイン</Link>
				</p>
			</section>
		</main>
	);
}
