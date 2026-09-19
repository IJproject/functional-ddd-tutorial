import type { LoggedOut, LogoutError } from "#/domain/auth/model/logout.model";
import { Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type LogoutResponse =
	| { ok: true; userId: string }
	| { ok: false; message: string };

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

/** ワークフロー外の失敗（通信断・想定外の例外）。例外の中身は出さず一律の文言に落とす。 */
export const UNEXPECTED_LOGOUT_RESPONSE: Extract<
	LogoutResponse,
	{ ok: false }
> = {
	ok: false,
	message: "ログアウトに失敗しました",
};

/** 未認証状態でのログアウト要求に対する文言は境界層が決める。 */
const NOT_AUTHENTICATED_MESSAGE = "すでにログアウトしています";
