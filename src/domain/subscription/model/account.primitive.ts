import type { Primitive } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type AccountId = Primitive<"AccountId", string>;
export type BillingAddress = Primitive<"BillingAddress", string>;
export type PaymentMethod = Primitive<
	"PaymentMethod",
	"CreditCard" | "BankTransfer"
>;
export type TrialUsedAt = Primitive<"TrialUsedAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const AccountId = {
	create: (input: string): AccountId => input as AccountId,
	value: (accountId: AccountId): string => accountId,
};

export const BillingAddress = {
	create: (input: string): BillingAddress => input as BillingAddress,
	value: (billingAddress: BillingAddress): string => billingAddress,
};

export const PaymentMethod = {
	/** 信頼境界の内側の値からの変換。リテラル型で絞っているので失敗しない。 */
	create: (input: "CreditCard" | "BankTransfer"): PaymentMethod =>
		input as PaymentMethod,
	value: (paymentMethod: PaymentMethod): "CreditCard" | "BankTransfer" =>
		paymentMethod,
};

export const TrialUsedAt = {
	create: (input: Date): TrialUsedAt => input as TrialUsedAt,
	value: (trialUsedAt: TrialUsedAt): Date => trialUsedAt,
};
