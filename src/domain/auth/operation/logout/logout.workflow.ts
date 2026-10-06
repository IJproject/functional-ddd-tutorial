import type { AuthProviderError } from "#/domain/auth/model/auth-provider.model";
import type {
	AuthenticatedSession,
	Session,
} from "#/domain/auth/model/session.model";
import type {
	LoggedOut,
	LogoutError,
} from "#/domain/auth/operation/logout/logout.model";
import type { LoggedOutAt } from "#/domain/auth/operation/logout/logout.primitive";
import {
	AsyncResult,
	err,
	matchChoice,
	ok,
	pipe,
} from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type LogoutWorkflow = (
	session: Session,
) => AsyncResult<LoggedOut, LogoutError | AuthProviderError>;

/** パイプラインを組み立てるための依存。各ステップと現在時刻の取得を注入する。 */
export type LogoutWorkflowDeps = {
	discardSession: DiscardSession;
	now: () => LoggedOutAt;
};
export type CreateLogoutWorkflow = (deps: LogoutWorkflowDeps) => LogoutWorkflow;

/**
 * 認証済み → 破棄済み。
 * 引数が AuthenticatedSession なので、認証済みであることを型で示さないと呼べない。
 */
export type DiscardSession = (
	session: AuthenticatedSession,
) => AsyncResult<void, AuthProviderError>;

/** 破棄済み → 出力イベント。純粋関数。 */
export type CreateLoggedOutEvent = (
	session: AuthenticatedSession,
	loggedOutAt: LoggedOutAt,
) => LoggedOut;

// ===========================================================================
// 実装
// ===========================================================================

export const createLoggedOutEvent: CreateLoggedOutEvent = (
	session,
	loggedOutAt,
) => ({
	userId: session.userId,
	loggedOutAt,
});

// Session に case が増えたとき認証状態の解釈漏れを型で検出するため、網羅的に分岐する。
export const createLogoutWorkflow: CreateLogoutWorkflow = (deps) => (session) =>
	matchChoice<Session, AsyncResult<LoggedOut, LogoutError | AuthProviderError>>(
		session,
		{
			AnonymousSession: async () => err({ kind: "NotAuthenticated" }),
			AuthenticatedSession: (authenticated) =>
				pipe(
					deps.discardSession(authenticated),
					AsyncResult.flatMap<void, LoggedOut, never>(() =>
						ok(createLoggedOutEvent(authenticated, deps.now())),
					),
				),
		},
	);
