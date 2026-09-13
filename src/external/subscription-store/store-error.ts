import type { Case } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

/**
 * 永続化された行をドメインの型として解釈できなかった。
 *
 * ドメインのエラーではない。ワークフローは Subscription を引数で受け取る純粋関数で、
 * 読み取りの失敗はその手前で起きるため、この型は境界層に置く。
 *
 * アプリは Subscription 型しか保存しないので通常は起こらない。
 * 手作業の UPDATE、マイグレーション、別経路の書き込みで壊れた行が生まれたときに、
 * 1970-01-01 のような嘘の値をドメインへ渡さず、ここで止めるためにある。
 */
export type StoreError =
	| Case<"MalformedSubscription", { accountId: string; reason: string }>
	| Case<"MalformedInvoice", { invoiceId: string; reason: string }>;

// ===========================================================================
// 実装
// ===========================================================================

/**
 * reason は調査に使う開発者向けの説明であり、列名などの内部情報を含む。
 * 境界層は reason を画面へ出さず、利用者向けの一律の文言へ変換する。
 */
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
