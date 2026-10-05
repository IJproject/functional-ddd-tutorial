import { LogoutResponse } from "#/domain/auth/operation/logout/logout.dto";
import { LoggedOutAt } from "#/domain/auth/operation/logout/logout.primitive";
import { createLogoutWorkflow } from "#/domain/auth/operation/logout/logout.workflow";
import { Result } from "#/domain/building-blocks";
import { currentSession } from "#/external/better-auth/current-session";
import { discardSession } from "#/external/better-auth/discard-session";

// composition root: ドメインのポートに具体的な実装を差し込む。
const logoutWorkflow = createLogoutWorkflow({
	discardSession,
	now: () => LoggedOutAt.create(new Date()),
});

/** ログアウト。セッション取得 → ワークフロー → encode。 */
export const logout = async (): Promise<LogoutResponse> =>
	Result.match(await currentSession(), {
		err: async () => LogoutResponse.unexpected,
		ok: async (session) => LogoutResponse.encode(await logoutWorkflow(session)),
	});
