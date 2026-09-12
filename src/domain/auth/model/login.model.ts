import type {
	LoggedInAt,
	RawPassword,
} from "#/domain/auth/model/login.primitive";
import type { EmailAddress, UserId } from "#/domain/auth/model/user.primitive";
import type { Case, NonEmptyArray } from "#/domain/building-blocks";

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

export type LoginError = ValidationFailed | AuthenticationFailed;

/** 入力値の形式が不正。フォーム項目ではなく、どの値オブジェクトの構築に失敗したかを表す。 */
export type LoginValidationError = InvalidEmail | InvalidPassword;
export type InvalidEmail = Case<"InvalidEmail", { message: string }>;
export type InvalidPassword = Case<"InvalidPassword", { message: string }>;

export type ValidationFailed = Case<
	"ValidationFailed",
	{ errors: NonEmptyArray<LoginValidationError> }
>;

export type AuthenticationFailed = Case<
	"AuthenticationFailed",
	{ attemptedEmail: EmailAddress }
>;
