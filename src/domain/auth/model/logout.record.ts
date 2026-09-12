import type { LoggedOutAt } from "#/domain/auth/model/logout.primitive";
import type { UserId } from "#/domain/auth/model/user.primitive";

export type LoggedOut = {
	userId: UserId;
	loggedOutAt: LoggedOutAt;
};
