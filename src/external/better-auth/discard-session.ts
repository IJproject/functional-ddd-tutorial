import { getRequestHeaders } from "@tanstack/react-start/server";
import type { DiscardSession } from "#/domain/auth/workflow/logout.workflow";
import { auth } from "#/external/better-auth/auth";

/**
 * ドメインの DiscardSession ポートを better-auth で満たすアダプタ。
 *
 * better-auth は破棄対象をリクエストの Cookie から判断するため、引数のセッションは使わない。
 * それでも型として AuthenticatedSession を要求することに意味がある。
 * 「認証済みであることを確かめずにセッション破棄を呼ぶ」コードが書けなくなるため。
 */
export const discardSession: DiscardSession = async () => {
	await auth.api.signOut({ headers: getRequestHeaders() });
};
