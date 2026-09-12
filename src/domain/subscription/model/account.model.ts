import type { Case } from "#/domain/building-blocks";
import type {
	AccountId,
	BillingAddress,
	PaymentMethod,
	TrialUsedAt,
} from "#/domain/subscription/model/account.primitive";

export type Account = TrialUnusedAccount | TrialUsedAccount;
export type TrialUnusedAccount = Case<
	"TrialUnusedAccount",
	{
		id: AccountId;
		billingAddress: BillingAddress;
		paymentMethod: PaymentMethod;
	}
>;
export type TrialUsedAccount = Case<
	"TrialUsedAccount",
	{
		id: AccountId;
		billingAddress: BillingAddress;
		paymentMethod: PaymentMethod;
		trialUsedAt: TrialUsedAt;
	}
>;
