import * as z from "zod";
import type { AuthProviderError } from "#/domain/auth/model/auth-provider.model";
import type {
	Registered,
	SignupError,
	SignupValidationError,
	UnvalidatedSignupCommand,
} from "#/domain/auth/operation/signup/signup.model";
import { matchChoice, Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（デシリアライズ: JSON → DTO）
// ===========================================================================

/** 境界（JSON）での parse。値として妥当かはドメインの仕事。 */
const signupRequestSchema = z.object({
	name: z.string(),
	email: z.string(),
	password: z.string(),
});

export type SignupRequest = z.infer<typeof signupRequestSchema>;

// ===========================================================================
// decode（DTO → ドメイン）
// ===========================================================================

/** SignupRequest → ドメインの未検証入力。 */
export const SignupRequest = {
	schema: signupRequestSchema,
	decode: (request: SignupRequest): UnvalidatedSignupCommand => ({
		name: request.name,
		email: request.email,
		password: request.password,
	}),
};

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** ドメインの結果 → SignupResponse。 */
export const SignupResponse = {
	encode: (
		result: Result<Registered, SignupError | AuthProviderError>,
	): SignupResponse =>
		Result.match<Registered, SignupError | AuthProviderError, SignupResponse>(
			result,
			{
				ok: (registered) => ({ ok: true, userId: registered.userId }),
				err: (error) =>
					matchChoice<SignupError | AuthProviderError, SignupResponse>(error, {
						ValidationFailed: (validationFailed) => ({
							ok: false,
							errors: validationFailed.errors.map(toFieldError),
						}),
						EmailAlreadyTaken: () => ({
							ok: false,
							errors: [{ field: null, message: EMAIL_ALREADY_TAKEN_MESSAGE }],
						}),
						AuthProviderUnavailable: () => ({
							ok: false,
							errors: [
								{ field: null, message: AUTH_PROVIDER_UNAVAILABLE_MESSAGE },
							],
						}),
					}),
			},
		),
	/** ワークフロー外の失敗（通信断・想定外の例外）。例外の中身は出さず一律の文言に落とす。 */
	unexpected: {
		ok: false,
		errors: [{ field: null, message: "登録に失敗しました" }],
	} satisfies Extract<SignupResponse, { ok: false }>,
	/**
	 * 認証基盤への登録は済んだが、口座の開設に失敗した。
	 * ログインすればアプリは使えるため、再登録ではなくログインへ誘導する。
	 */
	accountSetupIncomplete: {
		ok: false,
		errors: [
			{
				field: null,
				message: "アカウントは作成済みです。ログインしてください",
			},
		],
	} satisfies Extract<SignupResponse, { ok: false }>,
};

/**
 * メールアドレス重複時の文言は境界層が決める。
 * ドメインの EmailAlreadyTaken は種類だけを表し、ユーザー向けの言葉を持たない。
 */
const EMAIL_ALREADY_TAKEN_MESSAGE = "そのメールアドレスは登録済みです";
const AUTH_PROVIDER_UNAVAILABLE_MESSAGE = "時間をおいてもう一度お試しください";

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

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type SignupFieldError = {
	field: "name" | "email" | "password" | null;
	message: string;
};

export type SignupResponse =
	| { ok: true; userId: string }
	| { ok: false; errors: SignupFieldError[] };
