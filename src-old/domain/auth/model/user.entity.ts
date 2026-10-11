import type { EmailAddress, UserId } from "#/domain/auth/model/user.primitive";

export type AuthenticatedUser = {
	id: UserId;
	email: EmailAddress;
};
