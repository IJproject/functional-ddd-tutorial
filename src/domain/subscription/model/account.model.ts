import type { Case } from "#/domain/building-blocks";
import type {
	AccountId,
	TrialUsedAt,
} from "#/domain/subscription/model/account.primitive";

/**
 * 契約者。無料トライアルを使ったかどうかで申し込みの結果が変わるため、
 * その1点だけを Case で分ける。
 *
 * 請求先住所や支払い方法は持たない。設定する手段も、値を見て分岐する業務ルールも
 * 存在しないため、運ぶだけの配管になっていたので外した。
 * 必要になった時点で、その時のルールに合う形で入れ直す。
 */
export type Account = TrialUnusedAccount | TrialUsedAccount;

export type TrialUnusedAccount = Case<"TrialUnusedAccount", { id: AccountId }>;

export type TrialUsedAccount = Case<
	"TrialUsedAccount",
	{ id: AccountId; trialUsedAt: TrialUsedAt }
>;
