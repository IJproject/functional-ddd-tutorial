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

export const Subscription = {
	/** 無料で利用しており、有料プランの契約はない。 */
	free: (accountId: AccountId): FreeSubscription => ({
		kind: "FreeSubscription",
		accountId,
	}),

	/** 無料トライアル期間中である。 */
	trial: (fields: {
		accountId: AccountId;
		planId: PlanId;
		trialEndsAt: TrialEndsAt;
	}): TrialSubscription => ({ kind: "TrialSubscription", ...fields }),

	/** 新規契約の支払い完了を待っている。 */
	pendingPayment: (fields: {
		accountId: AccountId;
		planId: PlanId;
		pendingInvoiceId: InvoiceId;
	}): PendingPaymentSubscription => ({
		kind: "PendingPaymentSubscription",
		...fields,
	}),

	/** 有料プランを契約している。 */
	paid: (fields: {
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
	}): PaidSubscription => ({ kind: "PaidSubscription", ...fields }),

	/** 現行プランの契約中で、アップグレード差額の支払いを待っている。 */
	upgradePending: (fields: {
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
		pendingInvoiceId: InvoiceId;
	}): UpgradePendingSubscription => ({
		kind: "UpgradePendingSubscription",
		...fields,
	}),

	/** 現行の契約期間が終わった時点で解約する予定である。 */
	cancelReserved: (fields: {
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
	}): CancelReservedSubscription => ({
		kind: "CancelReservedSubscription",
		...fields,
	}),

	/** 現行の契約期間が終わった時点で別プランへ変更する予定である。 */
	planChangeReserved: (fields: {
		accountId: AccountId;
		planId: PlanId;
		periodEndsAt: PeriodEndsAt;
		nextPlanId: PlanId;
	}): PlanChangeReservedSubscription => ({
		kind: "PlanChangeReservedSubscription",
		...fields,
	}),
};
