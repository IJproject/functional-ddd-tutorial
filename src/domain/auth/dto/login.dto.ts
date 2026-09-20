import * as z from "zod";
import type {
	LoggedIn,
	LoginError,
	LoginValidationError,
	UnvalidatedLoginRequest,
} from "#/domain/auth/model/login.model";
import { matchChoice, Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（デシリアライズ: JSON → DTO）
// ===========================================================================

/** 境界（JSON）での parse。「メールとして妥当か」はドメインの仕事。 */
export const loginCommandSchema = z.object({
	email: z.string(),
	password: z.string(),
});

export type LoginCommand = z.infer<typeof loginCommandSchema>;

// ===========================================================================
// decode（DTO → ドメイン）
// ===========================================================================

/** LoginCommand → ドメインの未検証入力。 */
export const decodeLoginCommand = (
	command: LoginCommand,
): UnvalidatedLoginRequest => ({
	email: command.email,
	password: command.password,
});

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** ドメインの結果 → LoginResponse。 */
export const encodeLoginResponse = (
	result: Result<LoggedIn, LoginError>,
): LoginResponse =>
	Result.match<LoggedIn, LoginError, LoginResponse>(result, {
		ok: (loggedIn) => ({ ok: true, userId: loggedIn.userId }),
		err: (error) =>
			matchChoice<LoginError, LoginResponse>(error, {
				ValidationFailed: (validationFailed) => ({
					ok: false,
					errors: validationFailed.errors.map(toFieldError),
				}),
				AuthenticationFailed: () => ({
					ok: false,
					errors: [{ field: null, message: AUTHENTICATION_FAILED_MESSAGE }],
				}),
			}),
	});

/** ワークフロー外の失敗（通信断・想定外の例外）。例外の中身は出さず一律の文言に落とす。 */
export const UNEXPECTED_LOGIN_RESPONSE: Extract<LoginResponse, { ok: false }> =
	{
		ok: false,
		errors: [{ field: null, message: "ログインに失敗しました" }],
	};

/**
 * 認証失敗時の文言は境界層が決める。
 * ドメインの AuthenticationFailed は理由を持たないため、ここで一律の表現に落とす。
 */
const AUTHENTICATION_FAILED_MESSAGE =
	"メールアドレスまたはパスワードが違います";

/**
 * ドメインのエラーを、フォームのどの項目にどの文言で出すかへ翻訳する。
 * ドメインは理由の種類しか持たないので、言葉を与えるのは境界層の仕事。
 * matchChoice を使うのは、理由を追加したときに翻訳漏れがコンパイルエラーになるため。
 */
const toFieldError = (error: LoginValidationError): LoginFieldError =>
	matchChoice(error, {
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

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type LoginFieldError = {
	field: "email" | "password" | null;
	message: string;
};

export type LoginResponse =
	| { ok: true; userId: string }
	| { ok: false; errors: LoginFieldError[] };
