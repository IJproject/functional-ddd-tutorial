import { matchChoice } from "#/domain/building-blocks";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import type {
	Applied,
	ApplyContext,
} from "#/domain/subscription/model/apply.model";
import type {
	CancellationReserved,
	TrialCancelled,
} from "#/domain/subscription/model/cancel.model";
import type { PlanChanged } from "#/domain/subscription/model/change-plan.model";
import type { Invoice } from "#/domain/subscription/model/invoice.model";
import {
	Amount,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import type { PaymentSettled } from "#/domain/subscription/model/payment.model";
import type {
	PeriodEnded,
	TrialEnded,
} from "#/domain/subscription/model/schedule.model";
import type { Subscription } from "#/domain/subscription/model/subscription.model";
import {
	PeriodEndsAt,
	TrialEndsAt,
} from "#/domain/subscription/model/subscription.primitive";
import {
	type Subscription as StoredSubscription,
	store,
} from "#/external/subscription-store/store";
import {
	toDomainAccount,
	toDomainInvoice,
	toDomainSubscription,
	toStoredInvoicePurpose,
	toStoredInvoiceStatus,
	toStoredPlanId,
} from "#/external/subscription-store/translate";

// ===========================================================================
// 実装
// ===========================================================================

/**
 * 新規登録に伴う口座開設。
 * auth BC から subscription BC を import できないため、境界層がこのポートを呼ぶ。
 * 名前どおりの ensure 動作にするため、同じ accountId の既存レコードがあれば
 * そのレコードは追加せず、不足しているレコードだけを作る。
 */
export const openAccount = (accountId: AccountId): void => {
	const id = AccountId.value(accountId);
	if (!store.accounts.some((item) => item.id === id)) {
		store.accounts.push({
			id,
			billingAddress: "",
			paymentMethod: "",
			trialUsed: false,
			createdAt: new Date().toISOString(),
		});
	}
	if (!store.subscriptions.some((item) => item.accountId === id)) {
		store.subscriptions.push({
			accountId: id,
			status: "free",
			planId: "free",
		});
	}
};

/** ドメインの ApplyContext をストアから組み立てる。無ければ既定のレコードを作る。 */
export const loadApplyContext = (accountId: AccountId): ApplyContext => {
	const id = AccountId.value(accountId);
	let account = store.accounts.find((item) => item.id === id);
	if (!account) {
		account = {
			id,
			billingAddress: "",
			paymentMethod: "",
			trialUsed: false,
			createdAt: new Date().toISOString(),
		};
		store.accounts.push(account);
	}

	let subscription = store.subscriptions.find((item) => item.accountId === id);
	if (!subscription) {
		subscription = {
			accountId: id,
			status: "free",
			planId: "free",
		};
		store.subscriptions.push(subscription);
	}

	return {
		account: toDomainAccount(account),
		subscription: toDomainSubscription(subscription),
	};
};

/** 現在の契約状態だけを読む。 */
export const loadSubscription = (accountId: AccountId): Subscription => {
	const id = AccountId.value(accountId);
	let subscription = store.subscriptions.find((item) => item.accountId === id);
	if (!subscription) {
		subscription = {
			accountId: id,
			status: "free",
			planId: "free",
		};
		store.subscriptions.push(subscription);
	}
	return toDomainSubscription(subscription);
};

/** 請求の一覧。新しい順。 */
export const loadInvoices = (accountId: AccountId): Invoice[] =>
	store.invoices
		.filter((item) => item.accountId === AccountId.value(accountId))
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.map(toDomainInvoice);

/** 指定 ID の請求。アカウントが一致しなければ undefined。 */
export const findInvoice = (
	accountId: AccountId,
	invoiceId: InvoiceId,
): Invoice | undefined => {
	const invoice = store.invoices.find(
		(item) =>
			item.id === InvoiceId.value(invoiceId) &&
			item.accountId === AccountId.value(accountId),
	);
	return invoice ? toDomainInvoice(invoice) : undefined;
};

/**
 * ドメインの Subscription をストアのレコードへ書き戻す。
 * ドメインは新しい Case を返すが、永続化層の実装ではストアの可変更新を許容する。
 */
export const saveSubscription = (subscription: Subscription): void => {
	const record = matchChoice<Subscription, StoredSubscription>(subscription, {
		FreeSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "free" as const,
			planId: "free" as const,
			trialEndsAt: undefined,
			periodEndsAt: undefined,
			pendingInvoiceId: undefined,
			reservation: undefined,
		}),
		TrialSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "trial" as const,
			planId: toStoredPlanId(value.planId),
			trialEndsAt: TrialEndsAt.value(value.trialEndsAt).toISOString(),
			periodEndsAt: undefined,
			pendingInvoiceId: undefined,
			reservation: undefined,
		}),
		PendingPaymentSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "pending_payment" as const,
			planId: toStoredPlanId(value.planId),
			trialEndsAt: undefined,
			periodEndsAt: undefined,
			pendingInvoiceId: InvoiceId.value(value.pendingInvoiceId),
			reservation: undefined,
		}),
		PaidSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "paid" as const,
			planId: toStoredPlanId(value.planId),
			trialEndsAt: undefined,
			periodEndsAt: PeriodEndsAt.value(value.periodEndsAt).toISOString(),
			pendingInvoiceId: undefined,
			reservation: undefined,
		}),
		UpgradePendingSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "paid" as const,
			planId: toStoredPlanId(value.planId),
			trialEndsAt: undefined,
			periodEndsAt: PeriodEndsAt.value(value.periodEndsAt).toISOString(),
			pendingInvoiceId: InvoiceId.value(value.pendingInvoiceId),
			reservation: undefined,
		}),
		CancelReservedSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "paid" as const,
			planId: toStoredPlanId(value.planId),
			trialEndsAt: undefined,
			periodEndsAt: PeriodEndsAt.value(value.periodEndsAt).toISOString(),
			pendingInvoiceId: undefined,
			reservation: { kind: "cancel" as const },
		}),
		PlanChangeReservedSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "paid" as const,
			planId: toStoredPlanId(value.planId),
			trialEndsAt: undefined,
			periodEndsAt: PeriodEndsAt.value(value.periodEndsAt).toISOString(),
			pendingInvoiceId: undefined,
			reservation: {
				kind: "change_plan" as const,
				planId: toStoredPlanId(value.nextPlanId),
			},
		}),
	});
	const current = store.subscriptions.find(
		(item) => item.accountId === record.accountId,
	);
	if (current) Object.assign(current, record);
	else store.subscriptions.push(record);
};

/** ドメインの Invoice をストアのレコードへ書き戻す。 */
export const saveInvoice = (invoice: Invoice): void => {
	const id = InvoiceId.value(invoice.id);
	const current = store.invoices.find((item) => item.id === id);
	if (current) {
		current.status = toStoredInvoiceStatus(invoice);
		return;
	}
	store.invoices.push({
		id,
		accountId: AccountId.value(invoice.accountId),
		planId: toStoredPlanId(invoice.planId),
		amount: Amount.value(invoice.amount),
		kind: toStoredInvoicePurpose(invoice.purpose),
		status: toStoredInvoiceStatus(invoice),
		createdAt: IssuedAt.value(invoice.issuedAt).toISOString(),
	});
};

/** 申し込み結果をストアへ反映する。 */
export const saveApplied = (applied: Applied): void =>
	matchChoice<Applied, void>(applied, {
		TrialStarted: ({ account, subscription }) => {
			const accountRecord = store.accounts.find(
				(item) => item.id === AccountId.value(account.id),
			);
			if (accountRecord) accountRecord.trialUsed = true;
			saveSubscription(subscription);
		},
		PaymentRequested: ({ subscription, invoice }) => {
			saveInvoice(invoice);
			saveSubscription(subscription);
		},
	});

/** プラン変更結果をストアへ反映する。 */
export const savePlanChanged = (planChanged: PlanChanged): void =>
	matchChoice<PlanChanged, void>(planChanged, {
		PaymentRequested: ({ subscription, invoice }) => {
			saveInvoice(invoice);
			saveSubscription(subscription);
		},
		UpgradeRequested: ({ subscription, invoice }) => {
			saveInvoice(invoice);
			saveSubscription(subscription);
		},
		PlanChangeReserved: ({ subscription }) => saveSubscription(subscription),
	});

/** トライアル解約結果をストアへ反映する。 */
export const saveTrialCancelled = (result: TrialCancelled): void =>
	matchChoice<TrialCancelled, void>(result, {
		TrialCancelled: ({ subscription }) => saveSubscription(subscription),
	});

/** 解約予約結果をストアへ反映する。 */
export const saveCancellationReserved = (result: CancellationReserved): void =>
	matchChoice<CancellationReserved, void>(result, {
		CancellationReserved: ({ subscription }) => saveSubscription(subscription),
	});

/** 支払い結果をストアへ反映する。 */
export const savePaymentSettled = (result: PaymentSettled): void =>
	matchChoice<PaymentSettled, void>(result, {
		PaymentSettled: ({ subscription, invoice }) => {
			saveInvoice(invoice);
			saveSubscription(subscription);
		},
	});

/** トライアル終了結果をストアへ反映する。 */
export const saveTrialEnded = (result: TrialEnded): void =>
	matchChoice<TrialEnded, void>(result, {
		TrialEnded: ({ subscription, invoice }) => {
			saveInvoice(invoice);
			saveSubscription(subscription);
		},
	});

/** 期間満了結果をストアへ反映する。 */
export const savePeriodEnded = (result: PeriodEnded): void =>
	matchChoice<PeriodEnded, void>(result, {
		SubscriptionEnded: ({ subscription }) => saveSubscription(subscription),
		RenewalRequested: ({ subscription, invoice }) => {
			saveInvoice(invoice);
			saveSubscription(subscription);
		},
	});
