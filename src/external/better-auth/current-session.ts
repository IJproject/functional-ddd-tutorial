import { getRequestHeaders } from "@tanstack/react-start/server";
import type { Session } from "#/domain/auth/model/session.model";
import { UserId } from "#/domain/auth/model/user.primitive";
import { auth } from "#/external/better-auth/auth";

/** better-auth のセッションをドメインの Session に翻訳する。 */
export const currentSession = async (): Promise<Session> => {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	return session
		? { kind: "AuthenticatedSession", userId: UserId.create(session.user.id) }
		: { kind: "AnonymousSession" };
};
