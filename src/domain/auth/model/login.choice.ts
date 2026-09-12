import type { EmailAddress } from "#/domain/auth/model/user.primitive";
import type { Choice, NonEmptyArray } from "#/domain/building-blocks";

export type LoginError = ValidationFailed | AuthenticationFailed;

/** 入力値の形式が不正。フォーム項目ではなく、どの値オブジェクトの構築に失敗したかを表す。 */
export type LoginValidationError = InvalidEmail | InvalidPassword;
export type InvalidEmail = Choice<"InvalidEmail", { message: string }>;
export type InvalidPassword = Choice<"InvalidPassword", { message: string }>;

export type ValidationFailed = Choice<
	"ValidationFailed",
	{ errors: NonEmptyArray<LoginValidationError> }
>;

export type AuthenticationFailed = Choice<
	"AuthenticationFailed",
	{ attemptedEmail: EmailAddress }
>;
