import * as z from "zod";
import type {
	LoginError,
	LoginValidationError,
} from "#/domain/auth/model/login.choice";
import type {
	LoggedIn,
	UnvalidatedLoginRequest,
} from "#/domain/auth/model/login.record";
import type { Session } from "#/domain/auth/model/session.choice";
import { match, type Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

/** 境界（JSON）での parse。「メールとして妥当か」はドメインの createEmailAddress の仕事。 */
export const loginInputSchema = z.object({
	email: z.string(),
	password: z.string(),
});

export type LoginInputDto = z.infer<typeof loginInputSchema>;

export type LoginErrorDto = {
	field: "email" | "password" | null;
	message: string;
};

export type LoginOutputDto =
	| { ok: true; userId: string }
	| { ok: false; errors: LoginErrorDto[] };

export type SessionDto =
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

/** 入力 DTO → ドメインの未検証入力。 */
export const toUnvalidatedLoginRequest = (
	dto: LoginInputDto,
): UnvalidatedLoginRequest => ({
	email: dto.email,
	password: dto.password,
});

/** ドメインの結果 → 出力 DTO。 */
export const toLoginOutputDto = (
	result: Result<LoggedIn, LoginError>,
): LoginOutputDto =>
	match<LoggedIn, LoginError, LoginOutputDto>(result, {
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

/** ドメインの Session → 出力 DTO。 */
export const toSessionDto = (session: Session): SessionDto =>
	session.kind === "AuthenticatedSession"
		? { loggedIn: true, userId: session.userId }
		: { loggedIn: false };
