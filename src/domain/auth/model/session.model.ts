import type { UserId } from "#/domain/auth/model/user.primitive";
import type { Case } from "#/domain/building-blocks";

export type Session = AnonymousSession | AuthenticatedSession;

export type AnonymousSession = Case<"AnonymousSession">;

export type AuthenticatedSession = Case<
	"AuthenticatedSession",
	{ userId: UserId }
>;

/**
 * 認証基盤に到達できなかった、ワークフロー開始前の境界の失敗。
 * StoreError と同じく Wlaschin の RemoteServiceError に相当する。
 */
export type SessionError = Case<"SessionUnavailable", { reason: string }>;

export const SessionError = {
	sessionUnavailable: (reason: string): SessionError => ({
		kind: "SessionUnavailable",
		reason,
	}),
};
