import * as z from "zod";
import type {
	LoggedIn,
	LoginError,
	LoginValidationError,
	UnvalidatedLoginRequest,
} from "#/domain/auth/model/login.model";
import type { Session } from "#/domain/auth/model/session.model";
import { match, type Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

/** 境界（JSON）での parse。「メールとして妥当か」はドメインの EmailAddress.create の仕事。 */
export const loginCommandSchema = z.object({
	email: z.string(),
	password: z.string(),
});

export type LoginCommand = z.infer<typeof loginCommandSchema>;

export type LoginFieldError = {
	field: "email" | "password" | null;
	message: string;
};

export type LoginResult =
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

/** ドメインのエラーを、フォームのどの項目に出すかへ翻訳する。 */
const toFieldName = (error: LoginValidationError): "email" | "password" =>
	error.kind === "InvalidEmail" ? "email" : "password";

/** LoginCommand → ドメインの未検証入力。 */
export const decodeLoginCommand = (
	command: LoginCommand,
): UnvalidatedLoginRequest => ({
	email: command.email,
	password: command.password,
});

/** ドメインの結果 → LoginResult。 */
export const encodeLoginResult = (
	result: Result<LoggedIn, LoginError>,
): LoginResult =>
	match<LoggedIn, LoginError, LoginResult>(result, {
		ok: (loggedIn) => ({ ok: true, userId: loggedIn.userId }),
		err: (error) =>
			error.kind === "ValidationFailed"
				? {
						ok: false,
						errors: error.errors.map((validationError) => ({
							field: toFieldName(validationError),
							message: validationError.message,
						})),
					}
				: {
						ok: false,
						errors: [{ field: null, message: AUTHENTICATION_FAILED_MESSAGE }],
					},
	});

/** ドメインの Session → SessionView。 */
export const encodeSessionView = (session: Session): SessionView =>
	session.kind === "AuthenticatedSession"
		? { loggedIn: true, userId: session.userId }
		: { loggedIn: false };
