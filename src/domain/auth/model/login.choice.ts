import type { FieldError } from "#/domain/auth/model/login.record";
import type { EmailAddress } from "#/domain/auth/model/user.primitive";
import type { Choice } from "#/domain/building-blocks";

export type LoginError = ValidationFailed | AuthenticationFailed;

export type ValidationFailed = Choice<
	"ValidationFailed",
	{ errors: FieldError[] }
>;

export type AuthenticationFailed = Choice<
	"AuthenticationFailed",
	{ attemptedEmail: EmailAddress }
>;
