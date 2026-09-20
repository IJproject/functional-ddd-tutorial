import type {
	AuthenticationFailed,
	LoggedIn,
	LoginError,
	LoginValidationError,
	UnvalidatedLoginRequest,
	ValidatedLoginRequest,
	ValidationFailed,
} from "#/domain/auth/model/login.model";
import type { LoggedInAt } from "#/domain/auth/model/login.primitive";
import type { AuthenticatedUser } from "#/domain/auth/model/user.entity";
import { EmailAddress, Password } from "#/domain/auth/model/user.primitive";
import { AsyncResult, pipe, Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type LoginWorkflow = (
	request: UnvalidatedLoginRequest,
) => AsyncResult<LoggedIn, LoginError>;

/** パイプラインを組み立てるための依存。各ステップと現在時刻の取得を注入する。 */
export type LoginWorkflowDeps = {
	validateLoginRequest: ValidateLoginRequest;
	verifyCredentials: VerifyCredentials;
	createLoggedInEvent: CreateLoggedInEvent;
	now: () => LoggedInAt;
};
export type CreateLoginWorkflow = (deps: LoginWorkflowDeps) => LoginWorkflow;

/** 未検証 → 形式検証済み。Result を返す純粋関数。 */
export type ValidateLoginRequest = (
	request: UnvalidatedLoginRequest,
) => Result<ValidatedLoginRequest, ValidationFailed>;

/** 形式検証済み → 認証済み。I/O を伴うためドメインは型だけを定め、実装は外から注入する。 */
export type VerifyCredentials = (
	request: ValidatedLoginRequest,
) => AsyncResult<AuthenticatedUser, AuthenticationFailed>;

/** 認証済み → 出力イベント。純粋関数。 */
export type CreateLoggedInEvent = (
	user: AuthenticatedUser,
	loggedInAt: LoggedInAt,
) => LoggedIn;

// ===========================================================================
// 実装
// ===========================================================================

export const validateLoginRequest: ValidateLoginRequest = (request) => {
	const email = pipe(
		EmailAddress.create(request.email),
		Result.mapErr(
			(reason): LoginValidationError => ({ kind: "InvalidEmail", reason }),
		),
	);
	const password = pipe(
		Password.create(request.password),
		Result.mapErr(
			(reason): LoginValidationError => ({ kind: "InvalidPassword", reason }),
		),
	);

	// 1件目のエラーだけ返してもフォームとして使えないので combineAll を使う。
	return pipe(
		Result.combineAll([email, password]),
		Result.map(([email, password]) => ({ email, password })),
		Result.mapErr(
			(errors): ValidationFailed => ({ kind: "ValidationFailed", errors }),
		),
	);
};

export const createLoggedInEvent: CreateLoggedInEvent = (user, loggedInAt) => ({
	userId: user.id,
	loggedInAt,
});

export const createLoginWorkflow: CreateLoginWorkflow = (deps) => (request) =>
	pipe(
		deps.validateLoginRequest(request),
		AsyncResult.flatMap(deps.verifyCredentials),
		AsyncResult.map((user) => deps.createLoggedInEvent(user, deps.now())),
	);
