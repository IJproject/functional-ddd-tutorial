import type { LoggedOut, LogoutError } from "#/domain/auth/model/logout.model";
import { Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

export type LogoutResult =
	| { ok: true; userId: string }
	| { ok: false; message: string };

// ===========================================================================
// 実装
// ===========================================================================

/** 未認証状態でのログアウト要求に対する文言は境界層が決める。 */
const NOT_AUTHENTICATED_MESSAGE = "すでにログアウトしています";

export const encodeLogoutResult = (
	result: Result<LoggedOut, LogoutError>,
): LogoutResult =>
	Result.match<LoggedOut, LogoutError, LogoutResult>(result, {
		ok: (loggedOut) => ({ ok: true, userId: loggedOut.userId }),
		err: () => ({ ok: false, message: NOT_AUTHENTICATED_MESSAGE }),
	});
