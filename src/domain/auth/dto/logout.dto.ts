import type { LogoutError } from "#/domain/auth/model/logout.choice";
import type { LoggedOut } from "#/domain/auth/model/logout.record";
import { match, type Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

export type LogoutOutputDto =
	| { ok: true; userId: string }
	| { ok: false; message: string };

// ===========================================================================
// 実装
// ===========================================================================

/** 未認証状態でのログアウト要求に対する文言は境界層が決める。 */
const NOT_AUTHENTICATED_MESSAGE = "すでにログアウトしています";

export const toLogoutOutputDto = (
	result: Result<LoggedOut, LogoutError>,
): LogoutOutputDto =>
	match<LoggedOut, LogoutError, LogoutOutputDto>(result, {
		ok: (loggedOut) => ({ ok: true, userId: loggedOut.userId }),
		err: () => ({ ok: false, message: NOT_AUTHENTICATED_MESSAGE }),
	});
