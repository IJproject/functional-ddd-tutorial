import { type Case, matchChoice } from "#/domain/building-blocks";
import type { Account as DomainAccount } from "#/domain/subscription/model/account.model";
import {
	AccountId,
	BillingAddress,
	PaymentMethod,
	TrialUsedAt,
} from "#/domain/subscription/model/account.primitive";
import type {
	Invoice as DomainInvoice,
	InvoicePurpose,
} from "#/domain/subscription/model/invoice.model";
import {
	Amount,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { PlanId as DomainPlanId } from "#/domain/subscription/model/plan.primitive";
import type { Subscription as DomainSubscription } from "#/domain/subscription/model/subscription.model";
import {
	PeriodEndsAt,
	TrialEndsAt,
} from "#/domain/subscription/model/subscription.primitive";
import type {
	Account as StoredAccount,
	Invoice as StoredInvoice,
	PlanId as StoredPlanId,
	Subscription as StoredSubscription,
} from "#/external/subscription-store/store";

// ===========================================================================
// 型定義
// ===========================================================================

type StoredAccountChoice =
	| Case<"TrialUnused", { account: StoredAccount }>
	| Case<"TrialUsed", { account: StoredAccount }>;

type StoredSubscriptionChoice =
	| Case<"free", { subscription: StoredSubscription }>
	| Case<"trial", { subscription: StoredSubscription }>
	| Case<"pending_payment", { subscription: StoredSubscription }>
	| Case<"paid", { subscription: StoredSubscription }>;

type StoredPaidChoice =
	| Case<"Paid", { subscription: StoredSubscription }>
	| Case<
			"UpgradePending",
			{ subscription: StoredSubscription; invoiceId: string }
	  >
	| Case<"CancelReserved", { subscription: StoredSubscription }>
	| Case<
			"PlanChangeReserved",
			{ subscription: StoredSubscription; nextPlanId: StoredPlanId }
	  >;

type StoredInvoicePurposeChoice =
	| Case<"new">
	| Case<"renewal">
	| Case<"upgrade_diff">;

type StoredInvoiceStatusChoice = Case<"unpaid"> | Case<"paid"> | Case<"failed">;

// ===========================================================================
// 実装
// ===========================================================================

export const DOMAIN_PLAN_IDS: Readonly<
	Record<StoredPlanId, ReturnType<typeof DomainPlanId.create>>
> = {
	// free は非契約状態の sentinel であり、FreeSubscription の変換では参照しない。
	free: DomainPlanId.create("Basic"),
	basic: DomainPlanId.create("Basic"),
	pro: DomainPlanId.create("Pro"),
};

export const toDomainPlanId = (planId: StoredPlanId) => DOMAIN_PLAN_IDS[planId];
export const toStoredPlanId = (
	planId: ReturnType<typeof DomainPlanId.create>,
): StoredPlanId =>
	matchChoice<{ kind: "Basic" } | { kind: "Pro" }, StoredPlanId>(
		{ kind: DomainPlanId.value(planId) },
		{ Basic: () => "basic", Pro: () => "pro" },
	);

export const toDomainAccount = (account: StoredAccount): DomainAccount => {
	const choice: StoredAccountChoice = account.trialUsed
		? { kind: "TrialUsed", account }
		: { kind: "TrialUnused", account };
	return matchChoice(choice, {
		TrialUnused: ({ account: value }) => ({
			kind: "TrialUnusedAccount",
			id: AccountId.create(value.id),
			billingAddress: BillingAddress.create(value.billingAddress),
			// ストアは空文字を持ちうるため、暫定的に CreditCard へフォールバックする。
			// ストアがドメインより後に設計されたことによる不整合はステップ D 以降で扱う。
			paymentMethod: PaymentMethod.create(
				value.paymentMethod === "BankTransfer" ? "BankTransfer" : "CreditCard",
			),
		}),
		TrialUsed: ({ account: value }) => ({
			kind: "TrialUsedAccount",
			id: AccountId.create(value.id),
			billingAddress: BillingAddress.create(value.billingAddress),
			paymentMethod: PaymentMethod.create(
				value.paymentMethod === "BankTransfer" ? "BankTransfer" : "CreditCard",
			),
			// 現行ストアは使用日時を持たないため、既存レコードの作成日時で補う。
			trialUsedAt: TrialUsedAt.create(new Date(value.createdAt)),
		}),
	});
};

export const toPaidSubscription = (
	subscription: StoredSubscription,
): DomainSubscription => {
	const paidChoice: StoredPaidChoice = subscription.pendingInvoiceId
		? {
				kind: "UpgradePending",
				subscription,
				invoiceId: subscription.pendingInvoiceId,
			}
		: subscription.reservation?.kind === "cancel"
			? { kind: "CancelReserved", subscription }
			: subscription.reservation?.kind === "change_plan"
				? {
						kind: "PlanChangeReserved",
						subscription,
						nextPlanId: subscription.reservation.planId,
					}
				: { kind: "Paid", subscription };

	return matchChoice<StoredPaidChoice, DomainSubscription>(paidChoice, {
		Paid: ({ subscription: value }) => ({
			kind: "PaidSubscription",
			accountId: AccountId.create(value.accountId),
			planId: toDomainPlanId(value.planId),
			periodEndsAt: PeriodEndsAt.create(new Date(value.periodEndsAt ?? 0)),
		}),
		UpgradePending: ({ subscription: value, invoiceId }) => ({
			kind: "UpgradePendingSubscription",
			accountId: AccountId.create(value.accountId),
			planId: toDomainPlanId(value.planId),
			periodEndsAt: PeriodEndsAt.create(new Date(value.periodEndsAt ?? 0)),
			pendingInvoiceId: InvoiceId.create(invoiceId),
		}),
		CancelReserved: ({ subscription: value }) => ({
			kind: "CancelReservedSubscription",
			accountId: AccountId.create(value.accountId),
			planId: toDomainPlanId(value.planId),
			periodEndsAt: PeriodEndsAt.create(new Date(value.periodEndsAt ?? 0)),
		}),
		PlanChangeReserved: ({ subscription: value, nextPlanId }) => ({
			kind: "PlanChangeReservedSubscription",
			accountId: AccountId.create(value.accountId),
			planId: toDomainPlanId(value.planId),
			periodEndsAt: PeriodEndsAt.create(new Date(value.periodEndsAt ?? 0)),
			nextPlanId: toDomainPlanId(nextPlanId),
		}),
	});
};

export const toDomainSubscription = (
	subscription: StoredSubscription,
): DomainSubscription => {
	const choice = {
		kind: subscription.status,
		subscription,
	} as StoredSubscriptionChoice;
	return matchChoice<StoredSubscriptionChoice, DomainSubscription>(choice, {
		free: ({ subscription: value }) => ({
			kind: "FreeSubscription",
			accountId: AccountId.create(value.accountId),
		}),
		trial: ({ subscription: value }) => ({
			kind: "TrialSubscription",
			accountId: AccountId.create(value.accountId),
			planId: toDomainPlanId(value.planId),
			trialEndsAt: TrialEndsAt.create(new Date(value.trialEndsAt ?? 0)),
		}),
		pending_payment: ({ subscription: value }) => ({
			kind: "PendingPaymentSubscription",
			accountId: AccountId.create(value.accountId),
			planId: toDomainPlanId(value.planId),
			pendingInvoiceId: InvoiceId.create(value.pendingInvoiceId ?? ""),
		}),
		paid: ({ subscription: value }) => toPaidSubscription(value),
	});
};

export const toStoredInvoicePurpose = (
	purpose: InvoicePurpose,
): StoredInvoice["kind"] =>
	matchChoice<InvoicePurpose, StoredInvoice["kind"]>(purpose, {
		New: () => "new",
		Renewal: () => "renewal",
		UpgradeDifference: () => "upgrade_diff",
	});

export const toStoredInvoiceStatus = (
	invoice: DomainInvoice,
): StoredInvoice["status"] =>
	matchChoice<DomainInvoice, StoredInvoice["status"]>(invoice, {
		UnpaidInvoice: () => "unpaid",
		PaidInvoice: () => "paid",
		FailedInvoice: () => "failed",
	});

/** 永続化の請求レコード → ドメインの Invoice。 */
export const toDomainInvoice = (invoice: StoredInvoice): DomainInvoice => {
	const purpose = matchChoice<StoredInvoicePurposeChoice, InvoicePurpose>(
		{ kind: invoice.kind },
		{
			new: () => ({ kind: "New" }),
			renewal: () => ({ kind: "Renewal" }),
			upgrade_diff: () => ({ kind: "UpgradeDifference" }),
		},
	);
	const fields = {
		id: InvoiceId.create(invoice.id),
		accountId: AccountId.create(invoice.accountId),
		planId: toDomainPlanId(invoice.planId),
		amount: Amount.create(invoice.amount),
		purpose,
		issuedAt: IssuedAt.create(new Date(invoice.createdAt)),
	};

	return matchChoice<StoredInvoiceStatusChoice, DomainInvoice>(
		{ kind: invoice.status },
		{
			unpaid: () => ({ kind: "UnpaidInvoice", ...fields }),
			paid: () => ({ kind: "PaidInvoice", ...fields }),
			failed: () => ({ kind: "FailedInvoice", ...fields }),
		},
	);
};
