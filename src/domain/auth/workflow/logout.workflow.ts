import type { LogoutError } from "#/domain/auth/model/logout.choice";
import type { LoggedOutAt } from "#/domain/auth/model/logout.primitive";
import type { LoggedOut } from "#/domain/auth/model/logout.record";
import type {
	AuthenticatedSession,
	Session,
} from "#/domain/auth/model/session.choice";
import { err, ok, type Result } from "#/domain/building-blocks";

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
) => Promise<Result<LoggedOut, LogoutError>>;

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

export const createLogoutWorkflow: CreateLogoutWorkflow =
	(deps) => async (session) => {
		if (session.kind === "AnonymousSession")
			return err({ kind: "NotAuthenticated" });

		await deps.discardSession(session);
		return ok(deps.createLoggedOutEvent(session, deps.now()));
	};
