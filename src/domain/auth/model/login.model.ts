import type { LoggedInAt } from "#/domain/auth/model/login.primitive";
import type {
	EmailAddress,
	EmailAddressError,
	Password,
	PasswordError,
	UserId,
} from "#/domain/auth/model/user.primitive";
import type { Case, NonEmptyArray } from "#/domain/building-blocks";

export type UnvalidatedLoginRequest = {
	email: string;
	password: string;
};

export type ValidatedLoginRequest = {
	email: EmailAddress;
	password: Password;
};

export type LoggedIn = {
	userId: UserId;
	loggedInAt: LoggedInAt;
};

export type LoginError = ValidationFailed | AuthenticationFailed;

/** 入力値の形式が不正。フォーム項目ではなく、どの値オブジェクトの構築に失敗したかを表す。 */
export type LoginValidationError = InvalidEmail | InvalidPassword;
export type InvalidEmail = Case<"InvalidEmail", { reason: EmailAddressError }>;
export type InvalidPassword = Case<
	"InvalidPassword",
	{ reason: PasswordError }
>;

export type ValidationFailed = Case<
	"ValidationFailed",
	{ errors: NonEmptyArray<LoginValidationError> }
>;

export type AuthenticationFailed = Case<
	"AuthenticationFailed",
	{ attemptedEmail: EmailAddress }
>;
