import { getRequestHeaders } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import { UserName } from "#/domain/auth/model/signup.primitive";
import { UserId } from "#/domain/auth/model/user.primitive";
import type { RegisterUser } from "#/domain/auth/workflow/signup.workflow";
import { err, ok } from "#/domain/building-blocks";
import { auth } from "#/external/better-auth/auth";

/**
 * ドメインの RegisterUser ポートを better-auth で満たすアダプタ。
 *
 * 注意: better-auth の signUpEmail はユーザー登録と同時にセッション Cookie の発行も行う。
 * ドメインの型は「登録」だけを表しているが、better-auth ではこの2つを分離できないため、
 * このアダプタはセッション確立という副作用も併せ持つ。
 */
export const registerUser: RegisterUser = async (request) => {
	try {
		const result = await auth.api.signUpEmail({
			body: {
				name: UserName.value(request.name),
				email: request.email,
				password: request.password,
			},
			headers: getRequestHeaders(),
		});
		return ok({ id: UserId.create(result.user.id), email: request.email });
	} catch (error) {
		if (
			error instanceof APIError &&
			(error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
				error.body?.code === "USER_ALREADY_EXISTS")
		)
			return err({ kind: "EmailAlreadyTaken", attemptedEmail: request.email });
		throw error;
	}
};
