import type {
	AuthenticationFailed,
	LoginError,
	ValidationFailed,
} from "#/domain/auth/model/login.choice";
import type { LoggedInAt } from "#/domain/auth/model/login.primitive";
import type {
	LoggedIn,
	UnvalidatedLoginRequest,
	ValidatedLoginRequest,
} from "#/domain/auth/model/login.record";
import type { AuthenticatedUser } from "#/domain/auth/model/user.record";
import type { Result } from "#/domain/building-blocks";

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
