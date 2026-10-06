import { getRequestHeaders } from "@tanstack/react-start/server";
import { AuthProviderError } from "#/domain/auth/model/auth-provider.model";
import type { DiscardSession } from "#/domain/auth/operation/logout/logout.workflow";
import { err, ok } from "#/domain/building-blocks";
import { auth } from "#/external/better-auth/auth";

/**
 * ドメインの DiscardSession ポートを better-auth で満たすアダプタ。
 *
 * better-auth は破棄対象をリクエストの Cookie から判断するため、引数のセッションは使わない。
 * それでも型として AuthenticatedSession を要求することに意味がある。
 * 「認証済みであることを確かめずにセッション破棄を呼ぶ」コードが書けなくなるため。
 */
export const discardSession: DiscardSession = async () => {
	try {
		await auth.api.signOut({ headers: getRequestHeaders() });
		return ok(undefined);
	} catch (error) {
		return err(AuthProviderError.authProviderUnavailable(String(error)));
	}
};
