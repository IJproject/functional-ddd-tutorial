import type { LoggedOut, LogoutError } from "#/domain/auth/model/logout.model";
import type { LoggedOutAt } from "#/domain/auth/model/logout.primitive";
import type {
	AuthenticatedSession,
	Session,
} from "#/domain/auth/model/session.model";
import {
	type AsyncResult,
	err,
	matchChoice,
	ok,
} from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

/**
 * セッションを破棄する。
 * 引数が AuthenticatedSession なので、認証済みであることを型で示さないと呼べない。
 */
export type DiscardSession = (session: AuthenticatedSession) => Promise<void>;

/** 破棄済みのセッションから出力イベントを作る。純粋関数。 */
export type CreateLoggedOutEvent = (
	session: AuthenticatedSession,
	loggedOutAt: LoggedOutAt,
) => LoggedOut;

export type LogoutWorkflowDeps = {
	discardSession: DiscardSession;
	createLoggedOutEvent: CreateLoggedOutEvent;
	now: () => LoggedOutAt;
};

/**
 * パイプライン全体。
 * 入力は現在のセッション。取得の I/O は境界層が担い、ここは状態の解釈だけを行う。
 */
export type LogoutWorkflow = (
	session: Session,
) => AsyncResult<LoggedOut, LogoutError>;

export type CreateLogoutWorkflow = (deps: LogoutWorkflowDeps) => LogoutWorkflow;

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
	matchChoice<Session, AsyncResult<LoggedOut, LogoutError>>(session, {
		AnonymousSession: async () => err({ kind: "NotAuthenticated" }),
		AuthenticatedSession: async (authenticated) => {
			await deps.discardSession(authenticated);
			return ok(deps.createLoggedOutEvent(authenticated, deps.now()));
		},
	});
