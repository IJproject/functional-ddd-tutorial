import type { Primitive } from "#/domain/building-blocks";

export type AccountId = Primitive<"AccountId", string>;
export type BillingAddress = Primitive<"BillingAddress", string>;
export type PaymentMethod = Primitive<
	"PaymentMethod",
	"CreditCard" | "BankTransfer"
>;
export type TrialUsedAt = Primitive<"TrialUsedAt", Date>;
