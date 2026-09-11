import type { Choice } from "#/domain/building-blocks";
import type {
	AccountId,
	BillingAddress,
	PaymentMethod,
	TrialUsedAt,
} from "#/domain/subscription/model/account.primitive";

export type Account = TrialUnusedAccount | TrialUsedAccount;
export type TrialUnusedAccount = Choice<
	"TrialUnusedAccount",
	{
		id: AccountId;
		billingAddress: BillingAddress;
		paymentMethod: PaymentMethod;
	}
>;
export type TrialUsedAccount = Choice<
	"TrialUsedAccount",
	{
		id: AccountId;
		billingAddress: BillingAddress;
		paymentMethod: PaymentMethod;
		trialUsedAt: TrialUsedAt;
	}
>;
