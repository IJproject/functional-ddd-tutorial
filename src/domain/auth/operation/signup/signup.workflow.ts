import type { AuthProviderError } from "#/domain/auth/model/auth-provider.model";
import type { AuthenticatedUser } from "#/domain/auth/model/user.entity";
import { EmailAddress, Password } from "#/domain/auth/model/user.primitive";
import type {
	EmailAlreadyTaken,
	Registered,
	SignupError,
	SignupValidationError,
	UnvalidatedSignupCommand,
	ValidatedSignupCommand,
	ValidationFailed,
} from "#/domain/auth/operation/signup/signup.model";
import {
	type RegisteredAt,
	UserName,
} from "#/domain/auth/operation/signup/signup.primitive";
import { AsyncResult, pipe, Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type SignupWorkflow = (
	command: UnvalidatedSignupCommand,
) => AsyncResult<Registered, SignupError | AuthProviderError>;

/** パイプラインを組み立てるための依存。各ステップと現在時刻の取得を注入する。 */
export type SignupWorkflowDeps = {
	registerUser: RegisterUser;
	now: () => RegisteredAt;
};
export type CreateSignupWorkflow = (deps: SignupWorkflowDeps) => SignupWorkflow;

/** 未検証 → 形式検証済み。Result を返す純粋関数。 */
export type ValidateSignupCommand = (
	command: UnvalidatedSignupCommand,
) => Result<ValidatedSignupCommand, ValidationFailed>;

/** 形式検証済み → 登録済み。I/O を伴うためドメインは型だけを定め、実装は外から注入する。 */
export type RegisterUser = (
	command: ValidatedSignupCommand,
) => AsyncResult<AuthenticatedUser, EmailAlreadyTaken | AuthProviderError>;

/** 登録済み → 出力イベント。純粋関数。 */
export type CreateRegisteredEvent = (
	user: AuthenticatedUser,
	registeredAt: RegisteredAt,
) => Registered;

// ===========================================================================
// 実装
// ===========================================================================

export const validateSignupCommand: ValidateSignupCommand = (command) => {
	const name = pipe(
		UserName.create(command.name),
		Result.mapErr(
			(reason): SignupValidationError => ({ kind: "InvalidName", reason }),
		),
	);
	const email = pipe(
		EmailAddress.create(command.email),
		Result.mapErr(
			(reason): SignupValidationError => ({ kind: "InvalidEmail", reason }),
		),
	);
	const password = pipe(
		Password.create(command.password),
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

export const createSignupWorkflow: CreateSignupWorkflow = (deps) => (command) =>
	pipe(
		validateSignupCommand(command),
		AsyncResult.flatMap(deps.registerUser),
		AsyncResult.map((user) => createRegisteredEvent(user, deps.now())),
	);
