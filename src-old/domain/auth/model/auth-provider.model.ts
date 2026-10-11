import type { Case } from "#/domain/building-blocks";

/**
 * 認証基盤に到達できなかった、業務ルール違反ではない境界の失敗。
 * StoreError と同じく Wlaschin の RemoteServiceError に相当し、
 * DTO の encode が利用者向け Response へ翻訳する。
 */
export type AuthProviderError = Case<
	"AuthProviderUnavailable",
	{ reason: string }
>;

/** reason は調査用の内部情報であり、Response には含めない。 */
export const AuthProviderError = {
	authProviderUnavailable: (reason: string): AuthProviderError => ({
		kind: "AuthProviderUnavailable",
		reason,
	}),
};
