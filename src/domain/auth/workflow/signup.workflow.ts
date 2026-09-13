import type {
	EmailAlreadyTaken,
	Registered,
	SignupError,
	SignupValidationError,
	UnvalidatedSignupRequest,
	ValidatedSignupRequest,
	ValidationFailed,
} from "#/domain/auth/model/signup.model";
import {
	type RegisteredAt,
	UserName,
} from "#/domain/auth/model/signup.primitive";
import type { AuthenticatedUser } from "#/domain/auth/model/user.model";
import { EmailAddress, Password } from "#/domain/auth/model/user.primitive";
import { AsyncResult, pipe, Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

/** ① 未検証 → ② 形式検証済み。Result を返す純粋関数。 */
export type ValidateSignupRequest = (
	request: UnvalidatedSignupRequest,
) => Result<ValidatedSignupRequest, ValidationFailed>;

/** ② 形式検証済み → ③ 登録済み。I/O を伴うためドメインは型だけを定め、実装は外から注入する。 */
export type RegisterUser = (
	request: ValidatedSignupRequest,
) => AsyncResult<AuthenticatedUser, EmailAlreadyTaken>;

/** ③ 登録済み → 出力イベント。純粋関数。 */
export type CreateRegisteredEvent = (
	user: AuthenticatedUser,
	registeredAt: RegisteredAt,
) => Registered;

export type SignupWorkflowDeps = {
	validateSignupRequest: ValidateSignupRequest;
	registerUser: RegisterUser;
	createRegisteredEvent: CreateRegisteredEvent;
	now: () => RegisteredAt;
};

/** パイプライン全体。 */
export type SignupWorkflow = (
	request: UnvalidatedSignupRequest,
) => AsyncResult<Registered, SignupError>;

export type CreateSignupWorkflow = (deps: SignupWorkflowDeps) => SignupWorkflow;

// ===========================================================================
// 実装
// ===========================================================================

export const validateSignupRequest: ValidateSignupRequest = (request) => {
	const name = pipe(
		UserName.create(request.name),
		Result.mapErr(
			(reason): SignupValidationError => ({ kind: "InvalidName", reason }),
		),
	);
	const email = pipe(
		EmailAddress.create(request.email),
		Result.mapErr(
			(reason): SignupValidationError => ({ kind: "InvalidEmail", reason }),
		),
	);
	const password = pipe(
		Password.create(request.password),
		Result.mapErr(
			(reason): SignupValidationError => ({ kind: "InvalidPassword", reason }),
		),
	);

	// 1件目のエラーだけ返してもフォームとして使えないので combineAll を使う。
	return pipe(
		Result.combineAll([name, email, password]),
		Result.map(([name, email, password]) => ({ name, email, password })),
		Result.mapErr(
			(errors): ValidationFailed => ({ kind: "ValidationFailed", errors }),
		),
	);
};

export const createRegisteredEvent: CreateRegisteredEvent = (
	user,
	registeredAt,
) => ({
	userId: user.id,
	registeredAt,
});

export const createSignupWorkflow: CreateSignupWorkflow = (deps) => (request) =>
	pipe(
		deps.validateSignupRequest(request),
		AsyncResult.flatMap(deps.registerUser),
		AsyncResult.map((user) => deps.createRegisteredEvent(user, deps.now())),
	);
