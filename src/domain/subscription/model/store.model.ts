import type { Case } from "#/domain/building-blocks";

/**
 * 永続化された行をドメイン型として解釈できなかった、ワークフロー開始前の境界の失敗。
 * 業務ルール違反そのものではないが、Wlaschin の RemoteServiceError と同様に、
 * ワークフローを含むアプリケーションパイプラインのエラー型の一員として扱い、
 * DTO の encode が利用者向け Response へ翻訳するため subscription BC の model に置く。
 */
export type StoreError =
	| Case<"MalformedSubscription", { accountId: string; reason: string }>
	| Case<"MalformedInvoice", { invoiceId: string; reason: string }>;

/** reason は調査用の内部情報であり、Response には含めない。 */
export const StoreError = {
	malformedSubscription: (accountId: string, reason: string): StoreError => ({
		kind: "MalformedSubscription",
		accountId,
		reason,
	}),
	malformedInvoice: (invoiceId: string, reason: string): StoreError => ({
		kind: "MalformedInvoice",
		invoiceId,
		reason,
	}),
};
