import type { Session } from "#/domain/auth/model/session.model";
import { matchChoice } from "#/domain/building-blocks";

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

export const SessionView = {
	encode: (session: Session): SessionView => ({
		loggedIn: matchChoice<Session, boolean>(session, {
			AuthenticatedSession: () => true,
			AnonymousSession: () => false,
		}),
	}),
	/** セッションの読み取りに失敗したときの既定。ルートレイアウトを落とさないために使う。 */
	anonymous: { loggedIn: false } satisfies SessionView,
};

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type SessionView = { loggedIn: boolean };
