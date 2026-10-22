import type { SubmitEvent } from "react";
import { TextField } from "#/components/form/text-field";
import type { AsyncResult } from "#/domain/building-blocks";
import type { Registered, SignupError } from "#/domain/subscription/primitive";
import type { SignupFormDto } from "./index";

export function SignupPage({
	onSignup,
}: {
	onSignup: (form: SignupFormDto) => AsyncResult<Registered, SignupError[]>;
}) {
	async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		await onSignup({
			name: String(form.get("name")),
			email: String(form.get("email")),
			password: String(form.get("password")),
		});
	}

	return (
		<div className="demo-narrow">
			<section className="demo-panel">
				<h1 className="demo-title">Subsc Tutorial を始める</h1>
				<form onSubmit={handleSubmit} className="space-y-4">
					<TextField label="名前" name="name" required />
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
						minLength={8}
						required
					/>
					<button type="submit" className="demo-button w-full">
						登録する
					</button>
				</form>
				<p className="demo-muted mt-6">
					すでに登録済みですか？ <a href="/auth/login">ログイン</a>
				</p>
			</section>
		</div>
	);
}
