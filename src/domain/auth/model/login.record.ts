import type {
	LoggedInAt,
	RawPassword,
} from "#/domain/auth/model/login.primitive";
import type { EmailAddress, UserId } from "#/domain/auth/model/user.primitive";

export type UnvalidatedLoginRequest = {
	email: string;
	password: string;
};

export type ValidatedLoginRequest = {
	email: EmailAddress;
	password: RawPassword;
};

export type LoggedIn = {
	userId: UserId;
	loggedInAt: LoggedInAt;
};
