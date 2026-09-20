import type {
	EmailAddress,
	EmailAddressError,
	Password,
	PasswordError,
	UserId,
} from "#/domain/auth/model/user.primitive";
import type {
	RegisteredAt,
	UserName,
	UserNameError,
} from "#/domain/auth/operation/signup/signup.primitive";
import type { Case, NonEmptyArray } from "#/domain/building-blocks";

// ===========================================================================
// 入力
// ===========================================================================

export type UnvalidatedSignupRequest = {
	name: string;
	email: string;
	password: string;
};

export type ValidatedSignupRequest = {
	name: UserName;
	email: EmailAddress;
	password: Password;
};

// ===========================================================================
// イベント
// ===========================================================================

/** 出力イベント。 */
export type Registered = {
	userId: UserId;
	registeredAt: RegisteredAt;
};

// ===========================================================================
// エラー
// ===========================================================================

export type SignupError = ValidationFailed | EmailAlreadyTaken;

/** 入力値の形式が不正。フォーム項目ではなく、どの値オブジェクトの構築に失敗したかを表す。 */
export type SignupValidationError =
	| InvalidName
	| InvalidEmail
	| InvalidPassword;
export type InvalidName = Case<"InvalidName", { reason: UserNameError }>;
export type InvalidEmail = Case<"InvalidEmail", { reason: EmailAddressError }>;
export type InvalidPassword = Case<
	"InvalidPassword",
	{ reason: PasswordError }
>;

export type ValidationFailed = Case<
	"ValidationFailed",
	{ errors: NonEmptyArray<SignupValidationError> }
>;

/** 既に登録済みのメールアドレスで登録しようとした。 */
export type EmailAlreadyTaken = Case<
	"EmailAlreadyTaken",
	{ attemptedEmail: EmailAddress }
>;
