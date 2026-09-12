import type { UserId } from "#/domain/auth/model/user.primitive";
import type { Choice } from "#/domain/building-blocks";

export type Session = AnonymousSession | AuthenticatedSession;

export type AnonymousSession = Choice<
	"AnonymousSession",
	Record<string, never>
>;

export type AuthenticatedSession = Choice<
	"AuthenticatedSession",
	{ userId: UserId }
>;
