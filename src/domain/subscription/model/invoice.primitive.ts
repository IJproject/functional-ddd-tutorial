import type { Primitive } from "#/domain/building-blocks";

export type InvoiceId = Primitive<"InvoiceId", string>;
export const InvoiceId = {
	create: (input: string): InvoiceId => input as InvoiceId,
	value: (invoiceId: InvoiceId): string => invoiceId,
};

export type Amount = Primitive<"Amount", number>;
export const Amount = {
	/** 信頼境界の内側で計算した結果を受けるため、負数かどうかはここでは検証しない。 */
	create: (input: number): Amount => input as Amount,
	value: (amount: Amount): number => amount,
};

export type IssuedAt = Primitive<"IssuedAt", Date>;
export const IssuedAt = {
	create: (input: Date): IssuedAt => input as IssuedAt,
	value: (issuedAt: IssuedAt): Date => issuedAt,
};

/** 請求の支払いが成立した日時。 */
export type PaidAt = Primitive<"PaidAt", Date>;
export const PaidAt = {
	create: (input: Date): PaidAt => input as PaidAt,
	value: (paidAt: PaidAt): Date => paidAt,
};
