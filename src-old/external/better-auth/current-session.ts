import { getRequestHeaders } from "@tanstack/react-start/server";
import { AuthProviderError } from "#/domain/auth/model/auth-provider.model";
import type { Session } from "#/domain/auth/model/session.model";
import { UserId } from "#/domain/auth/model/user.primitive";
import { type AsyncResult, err, ok } from "#/domain/building-blocks";
import { auth } from "#/external/better-auth/auth";

/** better-auth のセッションをドメインの Session に翻訳する。 */
export const currentSession = async (): AsyncResult<
	Session,
	AuthProviderError
> => {
	try {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		return ok(
			session
				? {
						kind: "AuthenticatedSession",
						userId: UserId.create(session.user.id),
					}
				: { kind: "AnonymousSession" },
		);
	} catch (error) {
		return err(AuthProviderError.authProviderUnavailable(String(error)));
	}
};
