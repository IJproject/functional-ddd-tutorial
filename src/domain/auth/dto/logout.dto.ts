import type { LoggedOut, LogoutError } from "#/domain/auth/model/logout.model";
import { Result } from "#/domain/building-blocks";

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

export const encodeLogoutResponse = (
	result: Result<LoggedOut, LogoutError>,
): LogoutResponse =>
	Result.match<LoggedOut, LogoutError, LogoutResponse>(result, {
		ok: (loggedOut) => ({ ok: true, userId: loggedOut.userId }),
		err: () => ({ ok: false, message: NOT_AUTHENTICATED_MESSAGE }),
	});

/** 未認証状態でのログアウト要求に対する文言は境界層が決める。 */
const NOT_AUTHENTICATED_MESSAGE = "すでにログアウトしています";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type LogoutResponse =
	| { ok: true; userId: string }
	| { ok: false; message: string };
