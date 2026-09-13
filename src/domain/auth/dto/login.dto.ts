import * as z from "zod";
import type {
	LoggedIn,
	LoginError,
	LoginValidationError,
	UnvalidatedLoginRequest,
} from "#/domain/auth/model/login.model";
import type { Session } from "#/domain/auth/model/session.model";
import { matchChoice, Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

/** 境界（JSON）での parse。「メールとして妥当か」はドメインの仕事。 */
export const loginCommandSchema = z.object({
	email: z.string(),
	password: z.string(),
});

export type LoginCommand = z.infer<typeof loginCommandSchema>;

export type LoginFieldError = {
	field: "email" | "password" | null;
	message: string;
};

export type LoginResponse =
	| { ok: true; userId: string }
	| { ok: false; errors: LoginFieldError[] };

export type SessionView =
	| { loggedIn: false }
	| { loggedIn: true; userId: string };

// ===========================================================================
// 実装
// ===========================================================================

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

/** LoginCommand → ドメインの未検証入力。 */
export const decodeLoginCommand = (
	command: LoginCommand,
): UnvalidatedLoginRequest => ({
	email: command.email,
	password: command.password,
});

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

/** ドメインの Session → SessionView。 */
export const encodeSessionView = (session: Session): SessionView =>
	matchChoice(session, {
		AuthenticatedSession: (authenticated) => ({
			loggedIn: true,
			userId: authenticated.userId,
		}),
		AnonymousSession: () => ({ loggedIn: false }),
	});
