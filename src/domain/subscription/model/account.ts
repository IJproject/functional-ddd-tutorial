import type { Primitive, Variant } from "#/domain/building-blocks";

export type AccountId = Primitive<"AccountId", string>;
export type BillingAddress = Primitive<"BillingAddress", string>;
export type PaymentMethod = Primitive<
	"PaymentMethod",
	"CreditCard" | "BankTransfer"
>;
export type TrialUsedAt = Primitive<"TrialUsedAt", Date>;

export type Account = TrialUnusedAccount | TrialUsedAccount;
export type TrialUnusedAccount = Variant<
	"TrialUnusedAccount",
	{
		id: AccountId;
		billingAddress: BillingAddress;
		paymentMethod: PaymentMethod;
	}
>;
export type TrialUsedAccount = Variant<
	"TrialUsedAccount",
	{
		id: AccountId;
		billingAddress: BillingAddress;
		paymentMethod: PaymentMethod;
		trialUsedAt: TrialUsedAt;
	}
>;
