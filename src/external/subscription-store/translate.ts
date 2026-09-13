import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
	type Case,
	err,
	matchChoice,
	ok,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { Account } from "#/domain/subscription/model/account.model";
import {
	AccountId,
	TrialUsedAt,
} from "#/domain/subscription/model/account.primitive";
import type {
	Invoice,
	InvoicePurpose,
} from "#/domain/subscription/model/invoice.model";
import {
	Amount,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { PlanId } from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.model";
import {
	PeriodEndsAt,
	TrialEndsAt,
} from "#/domain/subscription/model/subscription.primitive";
import type {
	subscriptionAccount as subscriptionAccountTable,
	subscriptionInvoice as subscriptionInvoiceTable,
	subscription as subscriptionTable,
} from "#/external/db/schema";
import {
	StoreError,
	type StoreError as StoreErrorType,
} from "#/external/subscription-store/store-error";

// ===========================================================================
// 型定義
// ===========================================================================

type StoredAccount = InferSelectModel<typeof subscriptionAccountTable>;
type StoredSubscription = InferSelectModel<typeof subscriptionTable>;
type StoredInvoice = InferSelectModel<typeof subscriptionInvoiceTable>;

export type StoredSubscriptionValues = InferInsertModel<
	typeof subscriptionTable
>;
export type StoredInvoiceValues = InferInsertModel<
	typeof subscriptionInvoiceTable
>;

type StoredAccountChoice =
	| Case<"TrialUnused", { row: StoredAccount }>
	| Case<"TrialUsed", { row: StoredAccount; trialUsedAt: Date }>;

type StoredPlanChoice = Case<"Basic"> | Case<"Pro">;

type StoredSubscriptionChoice =
	| Case<"FreeSubscription", { row: StoredSubscription }>
	| Case<"TrialSubscription", { row: StoredSubscription }>
	| Case<"PendingPaymentSubscription", { row: StoredSubscription }>
	| Case<"PaidSubscription", { row: StoredSubscription }>
	| Case<"UpgradePendingSubscription", { row: StoredSubscription }>
	| Case<"CancelReservedSubscription", { row: StoredSubscription }>
	| Case<"PlanChangeReservedSubscription", { row: StoredSubscription }>;

type StoredInvoicePurposeChoice =
	| Case<"New">
	| Case<"Renewal">
	| Case<"UpgradeDifference">;

type StoredInvoiceStatusChoice =
	| Case<"UnpaidInvoice">
	| Case<"PaidInvoice">
	| Case<"FailedInvoice">;

// ===========================================================================
// 実装
// ===========================================================================

const subscriptionError = (
	row: StoredSubscription,
	reason: string,
): StoreErrorType => StoreError.malformedSubscription(row.accountId, reason);

const invoiceError = (row: StoredInvoice, reason: string): StoreErrorType =>
	StoreError.malformedInvoice(row.invoiceId, reason);

const toDomainPlanId = (
	planId: string,
	malformed: () => StoreErrorType,
): ResultType<PlanId, StoreErrorType> => {
	if (planId === "Basic") return ok(PlanId.create("Basic"));
	if (planId === "Pro") return ok(PlanId.create("Pro"));
	return err(malformed());
};

const toStoredPlanId = (planId: PlanId): StoredInvoice["planId"] =>
	matchChoice<StoredPlanChoice, StoredInvoice["planId"]>(
		{ kind: PlanId.value(planId) },
		{
			Basic: () => "Basic",
			Pro: () => "Pro",
		},
	);

/**
 * trial_used_at の NULL 有無だけで必ず Account のどちらかに解釈できる。
 * 現在は失敗経路がないが、読み取り変換の呼び出し規約を揃え、将来列が増えたときに
 * loadApplyContext の型を変えず検査を追加できるよう Result を返す。
 */
export const toDomainAccount = (
	row: StoredAccount,
): ResultType<Account, StoreErrorType> => {
	const choice: StoredAccountChoice =
		row.trialUsedAt === null
			? { kind: "TrialUnused", row }
			: { kind: "TrialUsed", row, trialUsedAt: row.trialUsedAt };
	return ok(
		matchChoice<StoredAccountChoice, Account>(choice, {
			TrialUnused: ({ row: value }) => ({
				kind: "TrialUnusedAccount",
				id: AccountId.create(value.accountId),
			}),
			TrialUsed: ({ row: value, trialUsedAt }) => ({
				kind: "TrialUsedAccount",
				id: AccountId.create(value.accountId),
				trialUsedAt: TrialUsedAt.create(trialUsedAt),
			}),
		}),
	);
};

const classifySubscription = (
	row: StoredSubscription,
): ResultType<StoredSubscriptionChoice, StoreErrorType> => {
	if (row.status === "FreeSubscription")
		return ok({ kind: "FreeSubscription", row });
	if (row.status === "TrialSubscription")
		return ok({ kind: "TrialSubscription", row });
	if (row.status === "PendingPaymentSubscription")
		return ok({ kind: "PendingPaymentSubscription", row });
	if (row.status === "PaidSubscription")
		return ok({ kind: "PaidSubscription", row });
	if (row.status === "UpgradePendingSubscription")
		return ok({ kind: "UpgradePendingSubscription", row });
	if (row.status === "CancelReservedSubscription")
		return ok({ kind: "CancelReservedSubscription", row });
	if (row.status === "PlanChangeReservedSubscription")
		return ok({ kind: "PlanChangeReservedSubscription", row });
	return err(subscriptionError(row, `unknown status=${row.status}`));
};

/**
 * 永続化された契約を、必要な列が揃ったドメインの7 Caseへ変換する。
 * 各状態で使わない列に値があっても、必要な情報が揃っていれば読み取る。
 * 厳格にすると状態遷移で古い列を消し忘れただけで読めなくなるためである。
 */
export const toDomainSubscription = (
	row: StoredSubscription,
): ResultType<Subscription, StoreErrorType> =>
	Result.match(classifySubscription(row), {
		err,
		ok: (choice) =>
			matchChoice<
				StoredSubscriptionChoice,
				ResultType<Subscription, StoreErrorType>
			>(choice, {
				FreeSubscription: ({ row: value }) =>
					ok({
						kind: "FreeSubscription",
						accountId: AccountId.create(value.accountId),
					}),
				TrialSubscription: ({ row: value }) => {
					const planIdValue = value.planId;
					const trialEndsAt = value.trialEndsAt;
					if (planIdValue === null)
						return err(
							subscriptionError(
								value,
								"status=TrialSubscription but plan_id is null",
							),
						);
					if (trialEndsAt === null)
						return err(
							subscriptionError(
								value,
								"status=TrialSubscription but trial_ends_at is null",
							),
						);
					return Result.match<
						PlanId,
						StoreErrorType,
						ResultType<Subscription, StoreErrorType>
					>(
						toDomainPlanId(planIdValue, () =>
							subscriptionError(
								value,
								`status=TrialSubscription has unknown plan_id=${planIdValue}`,
							),
						),
						{
							err,
							ok: (planId) =>
								ok({
									kind: "TrialSubscription",
									accountId: AccountId.create(value.accountId),
									planId,
									trialEndsAt: TrialEndsAt.create(trialEndsAt),
								}),
						},
					);
				},
				PendingPaymentSubscription: ({ row: value }) => {
					const planIdValue = value.planId;
					const pendingInvoiceId = value.pendingInvoiceId;
					if (planIdValue === null)
						return err(
							subscriptionError(
								value,
								"status=PendingPaymentSubscription but plan_id is null",
							),
						);
					if (pendingInvoiceId === null)
						return err(
							subscriptionError(
								value,
								"status=PendingPaymentSubscription but pending_invoice_id is null",
							),
						);
					return Result.match<
						PlanId,
						StoreErrorType,
						ResultType<Subscription, StoreErrorType>
					>(
						toDomainPlanId(planIdValue, () =>
							subscriptionError(
								value,
								`status=PendingPaymentSubscription has unknown plan_id=${planIdValue}`,
							),
						),
						{
							err,
							ok: (planId) =>
								ok({
									kind: "PendingPaymentSubscription",
									accountId: AccountId.create(value.accountId),
									planId,
									pendingInvoiceId: InvoiceId.create(pendingInvoiceId),
								}),
						},
					);
				},
				PaidSubscription: ({ row: value }) => {
					const planIdValue = value.planId;
					const periodEndsAt = value.periodEndsAt;
					if (planIdValue === null)
						return err(
							subscriptionError(
								value,
								"status=PaidSubscription but plan_id is null",
							),
						);
					if (periodEndsAt === null)
						return err(
							subscriptionError(
								value,
								"status=PaidSubscription but period_ends_at is null",
							),
						);
					return Result.match<
						PlanId,
						StoreErrorType,
						ResultType<Subscription, StoreErrorType>
					>(
						toDomainPlanId(planIdValue, () =>
							subscriptionError(
								value,
								`status=PaidSubscription has unknown plan_id=${planIdValue}`,
							),
						),
						{
							err,
							ok: (planId) =>
								ok({
									kind: "PaidSubscription",
									accountId: AccountId.create(value.accountId),
									planId,
									periodEndsAt: PeriodEndsAt.create(periodEndsAt),
								}),
						},
					);
				},
				UpgradePendingSubscription: ({ row: value }) => {
					const planIdValue = value.planId;
					const periodEndsAt = value.periodEndsAt;
					const pendingInvoiceId = value.pendingInvoiceId;
					if (planIdValue === null)
						return err(
							subscriptionError(
								value,
								"status=UpgradePendingSubscription but plan_id is null",
							),
						);
					if (periodEndsAt === null)
						return err(
							subscriptionError(
								value,
								"status=UpgradePendingSubscription but period_ends_at is null",
							),
						);
					if (pendingInvoiceId === null)
						return err(
							subscriptionError(
								value,
								"status=UpgradePendingSubscription but pending_invoice_id is null",
							),
						);
					return Result.match<
						PlanId,
						StoreErrorType,
						ResultType<Subscription, StoreErrorType>
					>(
						toDomainPlanId(planIdValue, () =>
							subscriptionError(
								value,
								`status=UpgradePendingSubscription has unknown plan_id=${planIdValue}`,
							),
						),
						{
							err,
							ok: (planId) =>
								ok({
									kind: "UpgradePendingSubscription",
									accountId: AccountId.create(value.accountId),
									planId,
									periodEndsAt: PeriodEndsAt.create(periodEndsAt),
									pendingInvoiceId: InvoiceId.create(pendingInvoiceId),
								}),
						},
					);
				},
				CancelReservedSubscription: ({ row: value }) => {
					const planIdValue = value.planId;
					const periodEndsAt = value.periodEndsAt;
					if (planIdValue === null)
						return err(
							subscriptionError(
								value,
								"status=CancelReservedSubscription but plan_id is null",
							),
						);
					if (periodEndsAt === null)
						return err(
							subscriptionError(
								value,
								"status=CancelReservedSubscription but period_ends_at is null",
							),
						);
					return Result.match<
						PlanId,
						StoreErrorType,
						ResultType<Subscription, StoreErrorType>
					>(
						toDomainPlanId(planIdValue, () =>
							subscriptionError(
								value,
								`status=CancelReservedSubscription has unknown plan_id=${planIdValue}`,
							),
						),
						{
							err,
							ok: (planId) =>
								ok({
									kind: "CancelReservedSubscription",
									accountId: AccountId.create(value.accountId),
									planId,
									periodEndsAt: PeriodEndsAt.create(periodEndsAt),
								}),
						},
					);
				},
				PlanChangeReservedSubscription: ({ row: value }) => {
					const planIdValue = value.planId;
					const periodEndsAt = value.periodEndsAt;
					const nextPlanIdValue = value.nextPlanId;
					if (planIdValue === null)
						return err(
							subscriptionError(
								value,
								"status=PlanChangeReservedSubscription but plan_id is null",
							),
						);
					if (periodEndsAt === null)
						return err(
							subscriptionError(
								value,
								"status=PlanChangeReservedSubscription but period_ends_at is null",
							),
						);
					if (nextPlanIdValue === null)
						return err(
							subscriptionError(
								value,
								"status=PlanChangeReservedSubscription but next_plan_id is null",
							),
						);
					return Result.match<
						PlanId,
						StoreErrorType,
						ResultType<Subscription, StoreErrorType>
					>(
						toDomainPlanId(planIdValue, () =>
							subscriptionError(
								value,
								`status=PlanChangeReservedSubscription has unknown plan_id=${planIdValue}`,
							),
						),
						{
							err,
							ok: (planId) =>
								Result.match<
									PlanId,
									StoreErrorType,
									ResultType<Subscription, StoreErrorType>
								>(
									toDomainPlanId(nextPlanIdValue, () =>
										subscriptionError(
											value,
											`status=PlanChangeReservedSubscription has unknown next_plan_id=${nextPlanIdValue}`,
										),
									),
									{
										err,
										ok: (nextPlanId) =>
											ok({
												kind: "PlanChangeReservedSubscription",
												accountId: AccountId.create(value.accountId),
												planId,
												periodEndsAt: PeriodEndsAt.create(periodEndsAt),
												nextPlanId,
											}),
									},
								),
						},
					);
				},
			}),
	});

const classifyInvoicePurpose = (
	row: StoredInvoice,
): ResultType<StoredInvoicePurposeChoice, StoreErrorType> => {
	if (row.purpose === "New") return ok({ kind: "New" });
	if (row.purpose === "Renewal") return ok({ kind: "Renewal" });
	if (row.purpose === "UpgradeDifference")
		return ok({ kind: "UpgradeDifference" });
	return err(invoiceError(row, `unknown purpose=${row.purpose}`));
};

const classifyInvoiceStatus = (
	row: StoredInvoice,
): ResultType<StoredInvoiceStatusChoice, StoreErrorType> => {
	if (row.status === "UnpaidInvoice") return ok({ kind: "UnpaidInvoice" });
	if (row.status === "PaidInvoice") return ok({ kind: "PaidInvoice" });
	if (row.status === "FailedInvoice") return ok({ kind: "FailedInvoice" });
	return err(invoiceError(row, `unknown status=${row.status}`));
};

/** 永続化の請求レコード → ドメインの Invoice。 */
export const toDomainInvoice = (
	row: StoredInvoice,
): ResultType<Invoice, StoreErrorType> =>
	Result.match(classifyInvoicePurpose(row), {
		err,
		ok: (purposeChoice) => {
			const purpose = matchChoice<StoredInvoicePurposeChoice, InvoicePurpose>(
				purposeChoice,
				{
					New: () => ({ kind: "New" }),
					Renewal: () => ({ kind: "Renewal" }),
					UpgradeDifference: () => ({ kind: "UpgradeDifference" }),
				},
			);
			return Result.match<
				PlanId,
				StoreErrorType,
				ResultType<Invoice, StoreErrorType>
			>(
				toDomainPlanId(row.planId, () =>
					invoiceError(row, `unknown plan_id=${row.planId}`),
				),
				{
					err,
					ok: (planId) =>
						Result.match<
							StoredInvoiceStatusChoice,
							StoreErrorType,
							ResultType<Invoice, StoreErrorType>
						>(classifyInvoiceStatus(row), {
							err,
							ok: (statusChoice) => {
								const fields = {
									id: InvoiceId.create(row.invoiceId),
									accountId: AccountId.create(row.accountId),
									planId,
									amount: Amount.create(row.amount),
									purpose,
									issuedAt: IssuedAt.create(row.issuedAt),
								};
								return ok(
									matchChoice<StoredInvoiceStatusChoice, Invoice>(
										statusChoice,
										{
											UnpaidInvoice: () => ({
												kind: "UnpaidInvoice",
												...fields,
											}),
											PaidInvoice: () => ({
												kind: "PaidInvoice",
												...fields,
											}),
											FailedInvoice: () => ({
												kind: "FailedInvoice",
												...fields,
											}),
										},
									),
								);
							},
						}),
				},
			);
		},
	});

const toStoredInvoicePurpose = (
	purpose: InvoicePurpose,
): StoredInvoiceValues["purpose"] =>
	matchChoice<InvoicePurpose, StoredInvoiceValues["purpose"]>(purpose, {
		New: () => "New",
		Renewal: () => "Renewal",
		UpgradeDifference: () => "UpgradeDifference",
	});

const toStoredInvoiceStatus = (
	invoice: Invoice,
): StoredInvoiceValues["status"] =>
	matchChoice<Invoice, StoredInvoiceValues["status"]>(invoice, {
		UnpaidInvoice: () => "UnpaidInvoice",
		PaidInvoice: () => "PaidInvoice",
		FailedInvoice: () => "FailedInvoice",
	});

/**
 * ドメインの契約 → upsert する値。
 * 未使用列にも null を明示し、状態遷移前の値を DB に残さない。
 */
export const toStoredSubscription = (
	subscription: Subscription,
): StoredSubscriptionValues =>
	matchChoice<Subscription, StoredSubscriptionValues>(subscription, {
		FreeSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "FreeSubscription",
			planId: null,
			trialEndsAt: null,
			periodEndsAt: null,
			pendingInvoiceId: null,
			nextPlanId: null,
		}),
		TrialSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "TrialSubscription",
			planId: toStoredPlanId(value.planId),
			trialEndsAt: TrialEndsAt.value(value.trialEndsAt),
			periodEndsAt: null,
			pendingInvoiceId: null,
			nextPlanId: null,
		}),
		PendingPaymentSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "PendingPaymentSubscription",
			planId: toStoredPlanId(value.planId),
			trialEndsAt: null,
			periodEndsAt: null,
			pendingInvoiceId: InvoiceId.value(value.pendingInvoiceId),
			nextPlanId: null,
		}),
		PaidSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "PaidSubscription",
			planId: toStoredPlanId(value.planId),
			trialEndsAt: null,
			periodEndsAt: PeriodEndsAt.value(value.periodEndsAt),
			pendingInvoiceId: null,
			nextPlanId: null,
		}),
		UpgradePendingSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "UpgradePendingSubscription",
			planId: toStoredPlanId(value.planId),
			trialEndsAt: null,
			periodEndsAt: PeriodEndsAt.value(value.periodEndsAt),
			pendingInvoiceId: InvoiceId.value(value.pendingInvoiceId),
			nextPlanId: null,
		}),
		CancelReservedSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "CancelReservedSubscription",
			planId: toStoredPlanId(value.planId),
			trialEndsAt: null,
			periodEndsAt: PeriodEndsAt.value(value.periodEndsAt),
			pendingInvoiceId: null,
			nextPlanId: null,
		}),
		PlanChangeReservedSubscription: (value) => ({
			accountId: AccountId.value(value.accountId),
			status: "PlanChangeReservedSubscription",
			planId: toStoredPlanId(value.planId),
			trialEndsAt: null,
			periodEndsAt: PeriodEndsAt.value(value.periodEndsAt),
			pendingInvoiceId: null,
			nextPlanId: toStoredPlanId(value.nextPlanId),
		}),
	});

/** ドメインの請求 → upsert する値。 */
export const toStoredInvoice = (invoice: Invoice): StoredInvoiceValues => ({
	invoiceId: InvoiceId.value(invoice.id),
	accountId: AccountId.value(invoice.accountId),
	planId: toStoredPlanId(invoice.planId),
	amount: Amount.value(invoice.amount),
	purpose: toStoredInvoicePurpose(invoice.purpose),
	status: toStoredInvoiceStatus(invoice),
	issuedAt: IssuedAt.value(invoice.issuedAt),
});
