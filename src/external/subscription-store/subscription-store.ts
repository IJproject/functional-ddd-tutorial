import { desc, eq } from "drizzle-orm";
import {
	type AsyncResult,
	err,
	matchChoice,
	ok,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
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
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import type { PaymentSettled } from "#/domain/subscription/model/payment.model";
import type {
	PeriodEnded,
	TrialEnded,
} from "#/domain/subscription/model/schedule.model";
import type { Subscription } from "#/domain/subscription/model/subscription.model";
import { db } from "#/external/db/client";
import {
	subscriptionAccount as subscriptionAccountTable,
	subscriptionInvoice as subscriptionInvoiceTable,
	subscription as subscriptionTable,
} from "#/external/db/schema";
import type { StoreError } from "#/external/subscription-store/store-error";
import {
	toDomainAccount,
	toDomainInvoice,
	toDomainSubscription,
	toStoredInvoice,
	toStoredSubscription,
} from "#/external/subscription-store/translate";

// ===========================================================================
// 型定義
// ===========================================================================

type WriteExecutor = Pick<typeof db, "insert" | "update">;

// ===========================================================================
// 実装
// ===========================================================================

const freeSubscription = (accountId: AccountId): Subscription => ({
	kind: "FreeSubscription",
	accountId,
});

const trialUnusedAccount = (accountId: AccountId): ApplyContext["account"] => ({
	kind: "TrialUnusedAccount",
	id: accountId,
});

/**
 * ドメインの Subscription を upsert する。
 * toStoredSubscription が未使用列にも null を入れるため、遷移前の値は残らない。
 */
const saveSubscription = async (
	executor: WriteExecutor,
	subscription: Subscription,
): Promise<void> => {
	const values = toStoredSubscription(subscription);
	await executor
		.insert(subscriptionTable)
		.values(values)
		.onConflictDoUpdate({
			target: subscriptionTable.accountId,
			set: {
				status: values.status,
				planId: values.planId,
				trialEndsAt: values.trialEndsAt,
				periodEndsAt: values.periodEndsAt,
				pendingInvoiceId: values.pendingInvoiceId,
				nextPlanId: values.nextPlanId,
			},
		});
};

/** ドメインの Invoice を upsert する。 */
const saveInvoice = async (
	executor: WriteExecutor,
	invoice: Invoice,
): Promise<void> => {
	const values = toStoredInvoice(invoice);
	await executor
		.insert(subscriptionInvoiceTable)
		.values(values)
		.onConflictDoUpdate({
			target: subscriptionInvoiceTable.invoiceId,
			set: {
				accountId: values.accountId,
				planId: values.planId,
				amount: values.amount,
				purpose: values.purpose,
				status: values.status,
				issuedAt: values.issuedAt,
			},
		});
};

/**
 * 新規登録に伴う口座開設。
 * auth BC から subscription BC を import できないため、境界層がこのポートを呼ぶ。
 * 口座と無料契約を同じトランザクションで作り、競合時は何もしないことで冪等にする。
 */
export const openAccount = async (accountId: AccountId): Promise<void> => {
	const id = AccountId.value(accountId);
	await db.transaction(async (tx) => {
		await tx
			.insert(subscriptionAccountTable)
			.values({ accountId: id, trialUsedAt: null })
			.onConflictDoNothing();
		await tx
			.insert(subscriptionTable)
			.values(toStoredSubscription(freeSubscription(accountId)))
			.onConflictDoNothing();
	});
};

/**
 * 申し込みに必要な契約者と契約を読む。
 * subscription_account が無い場合も読み取りでは作成せず、未使用アカウントと無料契約を返す。
 * signup 時の openAccount が完了していない状態でも画面自体を壊さず、作成経路を
 * openAccount だけに保つためである。
 */
export const loadApplyContext = async (
	accountId: AccountId,
): AsyncResult<ApplyContext, StoreError> => {
	const id = AccountId.value(accountId);
	const accountRows = await db
		.select()
		.from(subscriptionAccountTable)
		.where(eq(subscriptionAccountTable.accountId, id))
		.limit(1);
	const accountRow = accountRows[0];
	if (!accountRow)
		return ok({
			account: trialUnusedAccount(accountId),
			subscription: freeSubscription(accountId),
		});

	const subscriptionRows = await db
		.select()
		.from(subscriptionTable)
		.where(eq(subscriptionTable.accountId, id))
		.limit(1);
	const subscriptionRow = subscriptionRows[0];
	const account = toDomainAccount(accountRow);
	const subscription = subscriptionRow
		? toDomainSubscription(subscriptionRow)
		: ok(freeSubscription(accountId));

	return Result.match<
		ApplyContext["account"],
		StoreError,
		ResultType<ApplyContext, StoreError>
	>(account, {
		err,
		ok: (domainAccount) =>
			Result.match<
				Subscription,
				StoreError,
				ResultType<ApplyContext, StoreError>
			>(subscription, {
				err,
				ok: (domainSubscription) =>
					ok({
						account: domainAccount,
						subscription: domainSubscription,
					}),
			}),
	});
};

/**
 * 現在の契約状態だけを読む。
 * 行が無い場合は読み取りで補完せず FreeSubscription と解釈する。
 */
export const loadSubscription = async (
	accountId: AccountId,
): AsyncResult<Subscription, StoreError> => {
	const rows = await db
		.select()
		.from(subscriptionTable)
		.where(eq(subscriptionTable.accountId, AccountId.value(accountId)))
		.limit(1);
	const row = rows[0];
	return row ? toDomainSubscription(row) : ok(freeSubscription(accountId));
};

/** 請求の一覧。issued_at の新しい順に読み、壊れた行が1件でもあれば失敗する。 */
export const loadInvoices = async (
	accountId: AccountId,
): AsyncResult<Invoice[], StoreError> => {
	const rows = await db
		.select()
		.from(subscriptionInvoiceTable)
		.where(eq(subscriptionInvoiceTable.accountId, AccountId.value(accountId)))
		.orderBy(desc(subscriptionInvoiceTable.issuedAt));
	return Result.combine(rows.map(toDomainInvoice));
};

/** 指定 ID の請求。見つからない場合と壊れている場合を区別する。 */
export const findInvoice = async (
	accountId: AccountId,
	invoiceId: InvoiceId,
): AsyncResult<Invoice | null, StoreError> => {
	const rows = await db
		.select()
		.from(subscriptionInvoiceTable)
		.where(eq(subscriptionInvoiceTable.invoiceId, InvoiceId.value(invoiceId)))
		.limit(1);
	const row = rows[0];
	if (!row || row.accountId !== AccountId.value(accountId)) return ok(null);
	return toDomainInvoice(row);
};

/**
 * 書き込みは Promise<void> とし、接続断などのインフラ障害は例外で呼び出し元へ伝える。
 * 壊れた行を型で扱う読み取りとは異なり、保存失敗はドメインの想定内エラーではないためである。
 */

/** 申し込み結果をストアへ反映する。 */
export const saveApplied = (applied: Applied): Promise<void> =>
	matchChoice<Applied, Promise<void>>(applied, {
		TrialStarted: ({ account, subscription }) =>
			db.transaction(async (tx) => {
				await tx
					.update(subscriptionAccountTable)
					.set({ trialUsedAt: account.trialUsedAt })
					.where(
						eq(subscriptionAccountTable.accountId, AccountId.value(account.id)),
					);
				await saveSubscription(tx, subscription);
			}),
		PaymentRequested: ({ subscription, invoice }) =>
			db.transaction(async (tx) => {
				await saveInvoice(tx, invoice);
				await saveSubscription(tx, subscription);
			}),
	});

/** プラン変更結果をストアへ反映する。 */
export const savePlanChanged = (planChanged: PlanChanged): Promise<void> =>
	matchChoice<PlanChanged, Promise<void>>(planChanged, {
		PaymentRequested: ({ subscription, invoice }) =>
			db.transaction(async (tx) => {
				await saveInvoice(tx, invoice);
				await saveSubscription(tx, subscription);
			}),
		UpgradeRequested: ({ subscription, invoice }) =>
			db.transaction(async (tx) => {
				await saveInvoice(tx, invoice);
				await saveSubscription(tx, subscription);
			}),
		PlanChangeReserved: ({ subscription }) =>
			saveSubscription(db, subscription),
	});

/** トライアル解約結果をストアへ反映する。 */
export const saveTrialCancelled = (result: TrialCancelled): Promise<void> =>
	matchChoice<TrialCancelled, Promise<void>>(result, {
		TrialCancelled: ({ subscription }) => saveSubscription(db, subscription),
	});

/** 解約予約結果をストアへ反映する。 */
export const saveCancellationReserved = (
	result: CancellationReserved,
): Promise<void> =>
	matchChoice<CancellationReserved, Promise<void>>(result, {
		CancellationReserved: ({ subscription }) =>
			saveSubscription(db, subscription),
	});

/** 支払い結果をストアへ反映する。 */
export const savePaymentSettled = (result: PaymentSettled): Promise<void> =>
	matchChoice<PaymentSettled, Promise<void>>(result, {
		PaymentSettled: ({ subscription, invoice }) =>
			db.transaction(async (tx) => {
				await saveInvoice(tx, invoice);
				await saveSubscription(tx, subscription);
			}),
	});

/** トライアル終了結果をストアへ反映する。 */
export const saveTrialEnded = (result: TrialEnded): Promise<void> =>
	matchChoice<TrialEnded, Promise<void>>(result, {
		TrialEnded: ({ subscription, invoice }) =>
			db.transaction(async (tx) => {
				await saveInvoice(tx, invoice);
				await saveSubscription(tx, subscription);
			}),
	});

/** 期間満了結果をストアへ反映する。 */
export const savePeriodEnded = (result: PeriodEnded): Promise<void> =>
	matchChoice<PeriodEnded, Promise<void>>(result, {
		SubscriptionEnded: ({ subscription }) => saveSubscription(db, subscription),
		RenewalRequested: ({ subscription, invoice }) =>
			db.transaction(async (tx) => {
				await saveInvoice(tx, invoice);
				await saveSubscription(tx, subscription);
			}),
	});
