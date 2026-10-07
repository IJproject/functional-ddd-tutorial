import {
	SignupRequest,
	SignupResponse,
} from "#/domain/auth/operation/signup/signup.dto";
import { RegisteredAt } from "#/domain/auth/operation/signup/signup.primitive";
import { createSignupWorkflow } from "#/domain/auth/operation/signup/signup.workflow";
import { Result } from "#/domain/building-blocks";
import { toAccountId } from "#/domain/context-map/auth-to-subscription";
import { registerUser } from "#/external/better-auth/register-user";
import { openAccount } from "#/external/subscription-store/subscription-store";

// composition root: ドメインのポートに具体的な実装を差し込む。
const signupWorkflow = createSignupWorkflow({
	registerUser,
	now: () => RegisteredAt.create(new Date()),
});

/** 新規登録。ドメインの登録結果から口座を開設し、最後に応答へ変換する。 */
export const signup = async (
	request: SignupRequest,
): Promise<SignupResponse> => {
	const result = await signupWorkflow(SignupRequest.decode(request));
	// subscription BC の口座開設。BC を跨ぐ型の翻訳は境界層で行う。
	return Result.match(result, {
		err: async () => SignupResponse.encode(result),
		ok: async (registered) =>
			Result.match(await openAccount(toAccountId(registered.userId)), {
				err: () => SignupResponse.accountSetupIncomplete,
				ok: () => SignupResponse.encode(result),
			}),
	});
};
