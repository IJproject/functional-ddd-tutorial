import type {
	LoggedOut,
	LogoutError,
} from "#/domain/auth/operation/logout/logout.model";
import { matchChoice, Result } from "#/domain/building-blocks";

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

export const LogoutResponse = {
	encode: (
		result: Result<LoggedOut, LogoutError | AuthProviderError>,
	): LogoutResponse =>
		Result.match<LoggedOut, LogoutError | AuthProviderError, LogoutResponse>(
			result,
			{
				ok: (loggedOut) => ({ ok: true, userId: loggedOut.userId }),
				err: (error) =>
					matchChoice<LogoutError | AuthProviderError, LogoutResponse>(error, {
						NotAuthenticated: () => ({
							ok: false,
							message: NOT_AUTHENTICATED_MESSAGE,
						}),
						AuthProviderUnavailable: () => ({
							ok: false,
							message: AUTH_PROVIDER_UNAVAILABLE_MESSAGE,
						}),
					}),
			},
		),
	/** ワークフロー外の失敗（認証基盤に到達できないなど）。 */
	unexpected: {
		ok: false,
		message: "ログアウトに失敗しました",
	} satisfies Extract<LogoutResponse, { ok: false }>,
};

/** 未認証状態でのログアウト要求に対する文言は境界層が決める。 */
const NOT_AUTHENTICATED_MESSAGE = "すでにログアウトしています";
const AUTH_PROVIDER_UNAVAILABLE_MESSAGE = "時間をおいてもう一度お試しください";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type LogoutResponse =
	| { ok: true; userId: string }
	| { ok: false; message: string };

import type { AuthProviderError } from "#/domain/auth/model/auth-provider.model";
