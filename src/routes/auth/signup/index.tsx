import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import type { AsyncResult } from "#/domain/building-blocks";
import {
	type Registered,
	type SignupError,
	signup,
} from "#/domain/subscription/primitive";
import { registerUserAdapter } from "#/external/auth-provider/register-user";
import { SignupPage } from "./page";

export const Route = createFileRoute("/auth/signup/")({
	component: RouteComponent,
});

function RouteComponent() {
	const submit = (form: SignupFormDto) => submitSignup({ data: form });
	return <SignupPage onSignup={submit} />;
}

/** 新規登録のフォームから届いた値。形だけを確かめ、中身の検証はワークフローがする。 */
const signupFormSchema = z.object({
	name: z.string(),
	email: z.string(),
	password: z.string(),
});
export type SignupFormDto = z.infer<typeof signupFormSchema>;

/** サーバーで新規登録を受け付ける。signup に認証基盤のアダプターを差し込む（composition root）。 */
const submitSignup = createServerFn({ method: "POST" })
	.validator(signupFormSchema)
	.handler(
		({ data }): AsyncResult<Registered, SignupError[]> =>
			signup({ registerUser: registerUserAdapter })({ registration: data }),
	);
