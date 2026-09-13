import type { LoggedOut, LogoutError } from "#/domain/auth/model/logout.model";
import { Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type LogoutResponse =
	| { ok: true; userId: string }
	| { ok: false; message: string };

// ===========================================================================
// 実装
// ===========================================================================

/** 未認証状態でのログアウト要求に対する文言は境界層が決める。 */
const NOT_AUTHENTICATED_MESSAGE = "すでにログアウトしています";

export const encodeLogoutResponse = (
	result: Result<LoggedOut, LogoutError>,
): LogoutResponse =>
	Result.match<LoggedOut, LogoutError, LogoutResponse>(result, {
		ok: (loggedOut) => ({ ok: true, userId: loggedOut.userId }),
		err: () => ({ ok: false, message: NOT_AUTHENTICATED_MESSAGE }),
	});
