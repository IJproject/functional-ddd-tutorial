import { getRequestHeaders } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import { err, ok } from "#/domain/building-blocks";
import {
	UserId,
	type VerifyCredentialsPort,
} from "#/domain/subscription/primitive";
import { auth } from "#/external/auth-provider/auth";

/**
 * better-auth で資格情報を照合する。
 * better-auth の signInEmail は、照合と同時にセッションの Cookie も発行する。
 * ポートが表しているのは「照合」だけだが、better-auth ではこの2つを分けられないので、
 * このアダプターは「ログインした状態を作る」という副作用も持つ。
 */
export const verifyCredentialsAdapter: VerifyCredentialsPort = async ({
	email,
	password,
}) => {
	try {
		const { user } = await auth.api.signInEmail({
			body: { email, password },
			headers: getRequestHeaders(),
		});
		const userId = UserId.create(Number(user.id));
		if (!userId.ok) return err("AuthProviderMalformed");
		return ok(userId.value);
	} catch (error) {
		// メールアドレスが無い場合もパスワードが違う場合も UNAUTHORIZED になる。区別せずに「合わない」とする
		if (error instanceof APIError && error.status === "UNAUTHORIZED")
			return ok(null);
		console.error(error);
		return err("AuthProviderUnavailable");
	}
};
