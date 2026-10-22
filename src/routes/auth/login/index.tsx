import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import type { AsyncResult } from "#/domain/building-blocks";
import {
	type LoggedIn,
	type LoginError,
	login,
} from "#/domain/subscription/primitive";
import { verifyCredentialsAdapter } from "#/external/auth-provider/verify-credentials";
import { LoginPage } from "./page";

export const Route = createFileRoute("/auth/login/")({
	component: RouteComponent,
});

function RouteComponent() {
	const submit = (form: LoginFormDto) => submitLogin({ data: form });
	return <LoginPage onLogin={submit} />;
}

/** ログインのフォームから届いた値。形だけを確かめ、中身の検証はワークフローがする。 */
const loginFormSchema = z.object({ email: z.string(), password: z.string() });
export type LoginFormDto = z.infer<typeof loginFormSchema>;

/** サーバーでログインを受け付ける。login に認証基盤のアダプターを差し込む（composition root）。 */
const submitLogin = createServerFn({ method: "POST" })
	.validator(loginFormSchema)
	.handler(
		({ data }): AsyncResult<LoggedIn, LoginError[]> =>
			login({ verifyCredentials: verifyCredentialsAdapter })({
				credentials: data,
			}),
	);
