import type { SubmitEvent } from "react";
import { TextField } from "#/components/form/text-field";
import type { AsyncResult } from "#/domain/building-blocks";
import type { LoggedIn, LoginError } from "#/domain/subscription/primitive";
import type { LoginFormDto } from "./index";

export function LoginPage({
	onLogin,
}: {
	onLogin: (form: LoginFormDto) => AsyncResult<LoggedIn, LoginError[]>;
}) {
	async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		await onLogin({
			email: String(form.get("email")),
			password: String(form.get("password")),
		});
	}

	return (
		<div className="demo-narrow">
			<section className="demo-panel">
				<h1 className="demo-title">アカウントにログイン</h1>
				<form onSubmit={handleSubmit} className="space-y-4">
					<TextField
						label="メールアドレス"
						name="email"
						type="email"
						required
					/>
					<TextField
						label="パスワード"
						name="password"
						type="password"
						required
					/>
					<button type="submit" className="demo-button w-full">
						ログイン
					</button>
				</form>
				<p className="demo-muted mt-6">
					アカウントがない場合は <a href="/auth/signup">新規登録</a>
				</p>
			</section>
		</div>
	);
}
