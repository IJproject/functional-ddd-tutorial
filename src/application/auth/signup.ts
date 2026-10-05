import {
	SignupRequest,
	SignupResponse,
} from "#/domain/auth/operation/signup/signup.dto";
import { RegisteredAt } from "#/domain/auth/operation/signup/signup.primitive";
import { createSignupWorkflow } from "#/domain/auth/operation/signup/signup.workflow";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { registerUser } from "#/external/better-auth/register-user";
import { openAccount } from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込む。
const signupWorkflow = createSignupWorkflow({
	registerUser,
	now: () => RegisteredAt.create(new Date()),
});

/** 新規登録。decode → ワークフロー → encode → 口座開設。 */
export const signup = async (
	request: SignupRequest,
): Promise<SignupResponse> => {
	const response = SignupResponse.encode(
		await signupWorkflow(SignupRequest.decode(request)),
	);
	// subscription BC の口座開設。BC を跨ぐ型の翻訳は境界層で行う。
	if (response.ok) await openAccount(AccountId.create(response.userId));
	return response;
};
