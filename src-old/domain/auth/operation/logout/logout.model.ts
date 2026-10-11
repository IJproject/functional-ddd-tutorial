import type { UserId } from "#/domain/auth/model/user.primitive";
import type { LoggedOutAt } from "#/domain/auth/operation/logout/logout.primitive";
import type { Case } from "#/domain/building-blocks";

// ===========================================================================
// イベント
// ===========================================================================

export type LoggedOut = {
	userId: UserId;
	loggedOutAt: LoggedOutAt;
};

// ===========================================================================
// エラー
// ===========================================================================

export type LogoutError = NotAuthenticated;

/**
 * 認証済みでない状態からログアウトしようとした。
 * UI 上は起きにくいが、stale な画面からの POST や二重送信で発生しうる。
 */
export type NotAuthenticated = Case<"NotAuthenticated">;
