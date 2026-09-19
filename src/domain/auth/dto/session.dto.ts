import type { Session } from "#/domain/auth/model/session.model";
import { matchChoice } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type SessionView =
	| { loggedIn: false }
	| { loggedIn: true; userId: string };

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** ドメインの Session → SessionView。 */
export const encodeSessionView = (session: Session): SessionView =>
	matchChoice(session, {
		AuthenticatedSession: (authenticated) => ({
			loggedIn: true,
			userId: authenticated.userId,
		}),
		AnonymousSession: () => ({ loggedIn: false }),
	});

/** 取得に失敗したときの文言。SessionView は失敗の形を持たないため、文言だけを確定させる。 */
export const SESSION_UNAVAILABLE_MESSAGE = "セッションの取得に失敗しました";
