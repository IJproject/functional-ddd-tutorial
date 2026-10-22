import { getRequestHeaders } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import { err, ok } from "#/domain/building-blocks";
import { type RegisterUserPort, UserId } from "#/domain/subscription/primitive";
import { auth } from "#/external/auth-provider/auth";

/**
 * better-auth で利用者を登録する。
 * better-auth の signUpEmail は、登録と同時にログインした状態（セッションの Cookie）も作る。
 */
export const registerUserAdapter: RegisterUserPort = async ({
	name,
	email,
	password,
}) => {
	try {
		const { user } = await auth.api.signUpEmail({
			body: { name, email, password },
			headers: getRequestHeaders(),
		});
		const userId = UserId.create(Number(user.id));
		if (!userId.ok) return err("AuthProviderMalformed");
		return ok(userId.value);
	} catch (error) {
		// そのメールアドレスの利用者が、もういる
		if (
			error instanceof APIError &&
			error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
		)
			return ok(null);
		console.error(error);
		return err("AuthProviderUnavailable");
	}
};
