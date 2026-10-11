import type { UserId } from "#/domain/auth/model/user.primitive";
import type { Case } from "#/domain/building-blocks";

export type Session = AnonymousSession | AuthenticatedSession;

export type AnonymousSession = Case<"AnonymousSession">;

export type AuthenticatedSession = Case<
	"AuthenticatedSession",
	{ userId: UserId }
>;
