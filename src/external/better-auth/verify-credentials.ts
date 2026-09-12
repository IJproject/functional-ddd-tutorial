import { getRequestHeaders } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import type { AuthenticationFailed } from "#/domain/auth/model/login.model";
import { UserId } from "#/domain/auth/model/user.primitive";
import type { VerifyCredentials } from "#/domain/auth/workflow/login.workflow";
import { err, ok } from "#/domain/building-blocks";
import { auth } from "#/external/better-auth/auth";

/**
 * ドメインの VerifyCredentials ポートを better-auth で満たすアダプタ。
 *
 * 注意: better-auth の signInEmail は資格情報の照合と同時にセッション Cookie の発行も行う。
 * ドメインの型は「照合」だけを表しているが、better-auth ではこの2つを分離できないため、
 * このアダプタはセッション確立という副作用も併せ持つ。
 *
 * 失敗理由（ユーザー不在 / パスワード不一致）は意図的に区別せず、
 * すべて AuthenticationFailed に潰す（アカウント列挙を防ぐため）。
 */
export const verifyCredentials: VerifyCredentials = async (request) => {
	const failed: AuthenticationFailed = {
		kind: "AuthenticationFailed",
		attemptedEmail: request.email,
	};
	try {
		const result = await auth.api.signInEmail({
			body: { email: request.email, password: request.password },
			headers: getRequestHeaders(),
		});
		return ok({ id: UserId.create(result.user.id), email: request.email });
	} catch (error) {
		if (error instanceof APIError) return err(failed);
		throw error;
	}
};
