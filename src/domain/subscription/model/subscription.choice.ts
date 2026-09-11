import type { Choice } from "#/domain/building-blocks";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import type { PlanId } from "#/domain/subscription/model/plan.primitive";
import type {
	InvoiceId,
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

export type FreeSubscription = Choice<
	"FreeSubscription",
	{
		accountId: AccountId;
	}
>;
export type TrialSubscription = Choice<
	"TrialSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		trialEndsAt: TrialEndsAt;
	}
>;
export type PendingPaymentSubscription = Choice<
	"PendingPaymentSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		pendingInvoiceId: InvoiceId;
	}
>;
export type PaidSubscription = Choice<
	"PaidSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
	}
>;
export type UpgradePendingSubscription = Choice<
	"UpgradePendingSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
		pendingInvoiceId: InvoiceId;
	}
>;
export type CancelReservedSubscription = Choice<
	"CancelReservedSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
	}
>;
export type PlanChangeReservedSubscription = Choice<
	"PlanChangeReservedSubscription",
	{
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
		nextPlanId: PlanId;
	}
>;
