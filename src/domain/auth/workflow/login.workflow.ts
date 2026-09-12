import type {
	AuthenticationFailed,
	LoginError,
	LoginValidationError,
	ValidationFailed,
} from "#/domain/auth/model/login.choice";
import {
	createRawPassword,
	type LoggedInAt,
} from "#/domain/auth/model/login.primitive";
import type {
	LoggedIn,
	UnvalidatedLoginRequest,
	ValidatedLoginRequest,
} from "#/domain/auth/model/login.record";
import { createEmailAddress } from "#/domain/auth/model/user.primitive";
import type { AuthenticatedUser } from "#/domain/auth/model/user.record";
import {
	combineAll,
	flatMapAsync,
	map,
	mapErr,
	type Result,
} from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

/** ① 未検証 → ② 形式検証済み。純粋関数（Promise を返さないことで I/O 不在を型で示す）。 */
export type ValidateLoginRequest = (
	request: UnvalidatedLoginRequest,
) => Result<ValidatedLoginRequest, ValidationFailed>;

/** ② 形式検証済み → ③ 認証済み。I/O を伴うためドメインは型だけを定め、実装は外から注入する。 */
export type VerifyCredentials = (
	request: ValidatedLoginRequest,
) => Promise<Result<AuthenticatedUser, AuthenticationFailed>>;

/** ③ 認証済み → 出力イベント。純粋関数。 */
export type CreateLoggedInEvent = (
	user: AuthenticatedUser,
	loggedInAt: LoggedInAt,
) => LoggedIn;

export type LoginWorkflowDeps = {
	validateLoginRequest: ValidateLoginRequest;
	verifyCredentials: VerifyCredentials;
	createLoggedInEvent: CreateLoggedInEvent;
	now: () => LoggedInAt;
};

/** パイプライン全体。 */
export type LoginWorkflow = (
	request: UnvalidatedLoginRequest,
) => Promise<Result<LoggedIn, LoginError>>;

export type CreateLoginWorkflow = (deps: LoginWorkflowDeps) => LoginWorkflow;

// ===========================================================================
// 実装
// ===========================================================================

export const validateLoginRequest: ValidateLoginRequest = (request) => {
	const email = mapErr(
		createEmailAddress(request.email),
		(message): LoginValidationError => ({ kind: "InvalidEmail", message }),
	);
	const password = mapErr(
		createRawPassword(request.password),
		(message): LoginValidationError => ({ kind: "InvalidPassword", message }),
	);

	// 1件目のエラーだけ返してもフォームとして使えないので combineAll を使う。
	return mapErr(
		map(combineAll([email, password]), ([email, password]) => ({
			email,
			password,
		})),
		(errors): ValidationFailed => ({ kind: "ValidationFailed", errors }),
	);
};

export const createLoggedInEvent: CreateLoggedInEvent = (user, loggedInAt) => ({
	userId: user.id,
	loggedInAt,
});

export const createLoginWorkflow: CreateLoginWorkflow =
	(deps) => async (request) =>
		map(
			await flatMapAsync<ValidatedLoginRequest, AuthenticatedUser, LoginError>(
				deps.validateLoginRequest(request),
				deps.verifyCredentials,
			),
			(user) => deps.createLoggedInEvent(user, deps.now()),
		);
