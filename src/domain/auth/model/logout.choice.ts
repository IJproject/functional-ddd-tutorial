import type { Choice } from "#/domain/building-blocks";

export type LogoutError = NotAuthenticated;

/**
 * 認証済みでない状態からログアウトしようとした。
 * UI 上は起きにくいが、stale な画面からの POST や二重送信で発生しうる。
 */
export type NotAuthenticated = Choice<"NotAuthenticated">;
