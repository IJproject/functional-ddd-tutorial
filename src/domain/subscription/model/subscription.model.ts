import type { Case } from "#/domain/building-blocks";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import type { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import type { PlanId } from "#/domain/subscription/model/plan.primitive";
import type {
	PeriodEndsAt,
	TrialEndsAt,
} from "#/domain/subscription/model/subscription.primitive";

export type Subscription =
	| FreeSubscription
	| TrialSubscription
	| PendingPaymentSubscription
	| PaidSubscription
	| UpgradePendingSubscription
	| CancelReservedSubscription
	| PlanChangeReservedSubscription;

export type FreeSubscription = Case<
	"FreeSubscription",
	{
		accountId: AccountId;
	}
>;
export type TrialSubscription = Case<
	"TrialSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		trialEndsAt: TrialEndsAt;
	}
>;
export type PendingPaymentSubscription = Case<
	"PendingPaymentSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		pendingInvoiceId: InvoiceId;
	}
>;
export type PaidSubscription = Case<
	"PaidSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
	}
>;
export type UpgradePendingSubscription = Case<
	"UpgradePendingSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
		pendingInvoiceId: InvoiceId;
	}
>;
export type CancelReservedSubscription = Case<
	"CancelReservedSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
	}
>;
export type PlanChangeReservedSubscription = Case<
	"PlanChangeReservedSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
		nextPlanId: PlanId;
	}
>;
