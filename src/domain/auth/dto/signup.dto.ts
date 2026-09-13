import * as z from "zod";
import type {
	Registered,
	SignupError,
	SignupValidationError,
	UnvalidatedSignupRequest,
} from "#/domain/auth/model/signup.model";
import { matchChoice, Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

/** 境界（JSON）での parse。値として妥当かはドメインの仕事。 */
export const signupCommandSchema = z.object({
	name: z.string(),
	email: z.string(),
	password: z.string(),
});

export type SignupCommand = z.infer<typeof signupCommandSchema>;

export type SignupFieldError = {
	field: "name" | "email" | "password" | null;
	message: string;
};

export type SignupResponse =
	| { ok: true; userId: string }
	| { ok: false; errors: SignupFieldError[] };

// ===========================================================================
// 実装
// ===========================================================================

/**
 * メールアドレス重複時の文言は境界層が決める。
 * ドメインの EmailAlreadyTaken は種類だけを表し、ユーザー向けの言葉を持たない。
 */
const EMAIL_ALREADY_TAKEN_MESSAGE = "そのメールアドレスは登録済みです";

/**
 * ドメインのエラーを、フォームのどの項目にどの文言で出すかへ翻訳する。
 * ドメインは理由の種類しか持たないので、言葉を与えるのは境界層の仕事。
 * matchChoice を使うのは、理由を追加したときに翻訳漏れがコンパイルエラーになるため。
 */
const toFieldError = (error: SignupValidationError): SignupFieldError =>
	matchChoice(error, {
		InvalidName: ({ reason }) => ({
			field: "name",
			message: matchChoice(reason, {
				Empty: () => "名前を入力してください",
			}),
		}),
		InvalidEmail: ({ reason }) => ({
			field: "email",
			message: matchChoice(reason, {
				Empty: () => "メールアドレスを入力してください",
				Malformed: () => "メールアドレスの形式が正しくありません",
			}),
		}),
		InvalidPassword: ({ reason }) => ({
			field: "password",
			message: matchChoice(reason, {
				Empty: () => "パスワードを入力してください",
				TooShort: () => "パスワードは8文字以上で入力してください",
			}),
		}),
	});

/** SignupCommand → ドメインの未検証入力。 */
export const decodeSignupCommand = (
	command: SignupCommand,
): UnvalidatedSignupRequest => ({
	name: command.name,
	email: command.email,
	password: command.password,
});

/** ドメインの結果 → SignupResponse。 */
export const encodeSignupResponse = (
	result: Result<Registered, SignupError>,
): SignupResponse =>
	Result.match<Registered, SignupError, SignupResponse>(result, {
		ok: (registered) => ({ ok: true, userId: registered.userId }),
		err: (error) =>
			matchChoice<SignupError, SignupResponse>(error, {
				ValidationFailed: (validationFailed) => ({
					ok: false,
					errors: validationFailed.errors.map(toFieldError),
				}),
				EmailAlreadyTaken: () => ({
					ok: false,
					errors: [{ field: null, message: EMAIL_ALREADY_TAKEN_MESSAGE }],
				}),
			}),
	});
