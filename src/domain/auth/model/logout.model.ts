import type { LoggedOutAt } from "#/domain/auth/model/logout.primitive";
import type { UserId } from "#/domain/auth/model/user.primitive";
import type { Choice } from "#/domain/building-blocks";

export type LoggedOut = {
	userId: UserId;
	loggedOutAt: LoggedOutAt;
};

export type LogoutError = NotAuthenticated;

/**
 * 認証済みでない状態からログアウトしようとした。
 * UI 上は起きにくいが、stale な画面からの POST や二重送信で発生しうる。
 */
export type NotAuthenticated = Choice<"NotAuthenticated">;
