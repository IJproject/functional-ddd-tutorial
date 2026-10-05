import {
	LoginRequest,
	LoginResponse,
} from "#/domain/auth/operation/login/login.dto";
import { LoggedInAt } from "#/domain/auth/operation/login/login.primitive";
import { createLoginWorkflow } from "#/domain/auth/operation/login/login.workflow";
import { verifyCredentials } from "#/external/better-auth/verify-credentials";

// composition root: ドメインのポートに具体的な実装を差し込む。
const loginWorkflow = createLoginWorkflow({
	verifyCredentials,
	now: () => LoggedInAt.create(new Date()),
});

/** ログイン。decode → ワークフロー → encode。 */
export const login = async (request: LoginRequest): Promise<LoginResponse> =>
	LoginResponse.encode(await loginWorkflow(LoginRequest.decode(request)));
