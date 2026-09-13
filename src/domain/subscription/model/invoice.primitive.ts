import type { Primitive } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type InvoiceId = Primitive<"InvoiceId", string>;
export type Amount = Primitive<"Amount", number>;
export type IssuedAt = Primitive<"IssuedAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const InvoiceId = {
	create: (input: string): InvoiceId => input as InvoiceId,
	value: (invoiceId: InvoiceId): string => invoiceId,
};

export const Amount = {
	/** 信頼境界の内側で計算した結果を受けるため、負数かどうかはここでは検証しない。 */
	create: (input: number): Amount => input as Amount,
	value: (amount: Amount): number => amount,
};

export const IssuedAt = {
	create: (input: Date): IssuedAt => input as IssuedAt,
	value: (issuedAt: IssuedAt): Date => issuedAt,
};
