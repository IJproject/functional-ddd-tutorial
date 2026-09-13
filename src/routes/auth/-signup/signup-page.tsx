import { Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";
import {
	decodeSignupCommand,
	encodeSignupResponse,
	type SignupFieldError,
	signupCommandSchema,
} from "#/domain/auth/dto/signup.dto";
import { RegisteredAt } from "#/domain/auth/model/signup.primitive";
import {
	createRegisteredEvent,
	createSignupWorkflow,
	validateSignupRequest,
} from "#/domain/auth/workflow/signup.workflow";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { registerUser } from "#/external/better-auth/register-user";
import { openAccount } from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込むのはここだけ。
const signupWorkflow = createSignupWorkflow({
	validateSignupRequest,
	registerUser,
	createRegisteredEvent,
	now: () => RegisteredAt.create(new Date()),
});

const signup = createServerFn({ method: "POST" })
	.validator(signupCommandSchema)
	.handler(async ({ data }) => {
		const response = encodeSignupResponse(
			await signupWorkflow(decodeSignupCommand(data)),
		);
		// subscription BC の口座開設。BC を跨ぐ型の翻訳は境界層で行う。
		if (response.ok) await openAccount(AccountId.create(response.userId));
		return response;
	});

// ワークフロー外の失敗に対する文言。ドメインが想定していない失敗なので、
// 捕まえた例外の中身は表示せずに一律の表現へ落とす（内部情報を漏らさないため）。
const UNEXPECTED_SIGNUP_ERROR: SignupFieldError = {
	field: null,
	message: "登録に失敗しました",
};

export function SignupPage() {
	const navigate = useNavigate();
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
			await navigate({ to: "/subscription/edit" });
		} catch {
			// ここに来るのは通信断や、アダプタが投げ直したインフラ障害だけ。
			setErrors([UNEXPECTED_SIGNUP_ERROR]);
		}
	}
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">アカウント登録</p>
				<h1 className="demo-title">Subsc Tutorial を始める</h1>
				{formErrors.length > 0 && (
					<div className="demo-alert demo-alert-danger">
						{formErrors.map((item) => (
							<p key={item.message}>{item.message}</p>
						))}
					</div>
				)}
				<form onSubmit={submit} className="space-y-4">
					<label className="block">
						名前
						<input
							name="name"
							required
							className="demo-input mt-1 w-full"
							aria-invalid={nameErrors.length > 0}
							aria-describedby={
								nameErrors.length > 0 ? "name-error" : undefined
							}
						/>
						{nameErrors.length > 0 && (
							<span id="name-error" className="demo-field-error">
								{nameErrors.map((item) => item.message).join(" / ")}
							</span>
						)}
					</label>
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
							minLength={8}
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
