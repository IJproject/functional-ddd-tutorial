import { desc, eq } from "drizzle-orm";
import {
	type AsyncResult,
	err,
	matchChoice,
	ok,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { Account } from "#/domain/subscription/model/account.entity";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import type { Invoice } from "#/domain/subscription/model/invoice.entity";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import { StoreError } from "#/domain/subscription/model/store.model";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import type { Applied } from "#/domain/subscription/operation/apply/apply.model";
import type {
	CancellationReserved,
	TrialCancelled,
} from "#/domain/subscription/operation/cancel/cancel.model";
import type { PlanChanged } from "#/domain/subscription/operation/change-plan/change-plan.model";
import type { PaymentSettled } from "#/domain/subscription/operation/payment/payment.model";
import type {
	PeriodEnded,
	TrialEnded,
} from "#/domain/subscription/operation/schedule/schedule.model";
import { db } from "#/external/db/client";
import {
	subscriptionAccount as subscriptionAccountTable,
	subscriptionInvoice as subscriptionInvoiceTable,
	subscription as subscriptionTable,
} from "#/external/db/schema";
import {
	StoredAccount,
	StoredInvoice,
	StoredSubscription,
} from "#/external/subscription-store/translate";

// ===========================================================================
// 型定義
// ===========================================================================

type WriteExecutor = Pick<typeof db, "insert" | "update">;
type FoundApplyContext = {
	account: Account | null;
	subscription: Subscription | null;
};

/** ストアへの操作を2トラックに乗せる。到達できない・操作に失敗したを StoreUnavailable に落とす。 */
const attempt = async <T>(
	operation: () => Promise<T>,
): Promise<ResultType<T, StoreError>> => {
	try {
		return ok(await operation());
	} catch (error) {
		return err(StoreError.storeUnavailable(String(error)));
	}
};

// ===========================================================================
// 実装
// ===========================================================================

/**
 * ドメインの Subscription を upsert する。
 * StoredSubscription.encode が未使用列にも null を入れるため、遷移前の値は残らない。
 */
const saveSubscription = (
	executor: WriteExecutor,
	subscription: Subscription,
): AsyncResult<void, StoreError> =>
	attempt(async () => {
		const values = StoredSubscription.encode(subscription);
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
	});

/** ドメインの Invoice を upsert する。 */
const saveInvoice = (
	executor: WriteExecutor,
	invoice: Invoice,
): AsyncResult<void, StoreError> =>
	attempt(async () => {
		const values = StoredInvoice.encode(invoice);
		await executor
			.insert(subscriptionInvoiceTable)
			.values(values)
			.onConflictDoUpdate({
				target: subscriptionInvoiceTable.invoiceId,
				set: {
					accountId: values.accountId,
					planId: values.planId,
					previousPlanId: values.previousPlanId,
					amount: values.amount,
					purpose: values.purpose,
					status: values.status,
					issuedAt: values.issuedAt,
				},
			});
	});

/**
 * 新規登録に伴う口座開設。
 * auth BC から subscription BC を import できないため、境界層がこのポートを呼ぶ。
 * 口座と無料契約を同じトランザクションで作り、競合時は何もしないことで冪等にする。
 */
export const openAccount = (
	accountId: AccountId,
): AsyncResult<void, StoreError> =>
	attempt(async () => {
		const id = AccountId.value(accountId);
		await db.transaction(async (tx) => {
			await tx
				.insert(subscriptionAccountTable)
				.values({ accountId: id, trialUsedAt: null })
				.onConflictDoNothing();
			await tx
				.insert(subscriptionTable)
				.values(StoredSubscription.encode(Subscription.free(accountId)))
				.onConflictDoNothing();
		});
	});

/** 申し込みに必要な契約者と契約。行が無いものは null を返す。 */
export const loadApplyContext = async (
	accountId: AccountId,
): AsyncResult<FoundApplyContext, StoreError> => {
	const id = AccountId.value(accountId);
	const accountResult = await attempt(() =>
		db
			.select()
			.from(subscriptionAccountTable)
			.where(eq(subscriptionAccountTable.accountId, id))
			.limit(1),
	);
	if (accountResult.tag === "err") return accountResult;
	const accountRows = accountResult.value;
	const accountRow = accountRows[0];
	if (!accountRow)
		return ok({
			account: null,
			subscription: null,
		});

	const subscriptionResult = await attempt(() =>
		db
			.select()
			.from(subscriptionTable)
			.where(eq(subscriptionTable.accountId, id))
			.limit(1),
	);
	if (subscriptionResult.tag === "err") return subscriptionResult;
	const subscriptionRows = subscriptionResult.value;
	const subscriptionRow = subscriptionRows[0];
	const account = StoredAccount.decode(accountRow);
	const subscription = subscriptionRow
		? StoredSubscription.decode(subscriptionRow)
		: ok(null);

	return Result.match<
		Account,
		StoreError,
		ResultType<FoundApplyContext, StoreError>
	>(account, {
		err,
		ok: (domainAccount) =>
			Result.match<
				Subscription | null,
				StoreError,
				ResultType<FoundApplyContext, StoreError>
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

/** 契約。行がまだ無いアカウントは null を返す。不在が何を意味するかはドメインが決める。 */
export const loadSubscription = async (
	accountId: AccountId,
): AsyncResult<Subscription | null, StoreError> => {
	const loaded = await attempt(() =>
		db
			.select()
			.from(subscriptionTable)
			.where(eq(subscriptionTable.accountId, AccountId.value(accountId)))
			.limit(1),
	);
	if (loaded.tag === "err") return loaded;
	const rows = loaded.value;
	const row = rows[0];
	return row ? StoredSubscription.decode(row) : ok(null);
};

/** 請求の一覧。issued_at の新しい順に読み、壊れた行が1件でもあれば失敗する。 */
export const loadInvoices = async (
	accountId: AccountId,
): AsyncResult<Invoice[], StoreError> => {
	const loaded = await attempt(() =>
		db
			.select()
			.from(subscriptionInvoiceTable)
			.where(eq(subscriptionInvoiceTable.accountId, AccountId.value(accountId)))
			.orderBy(desc(subscriptionInvoiceTable.issuedAt)),
	);
	if (loaded.tag === "err") return loaded;
	const rows = loaded.value;
	return Result.combine(rows.map(StoredInvoice.decode));
};

/** 指定 ID の請求。見つからない場合と壊れている場合を区別する。 */
export const findInvoice = async (
	accountId: AccountId,
	invoiceId: InvoiceId,
): AsyncResult<Invoice | null, StoreError> => {
	const loaded = await attempt(() =>
		db
			.select()
			.from(subscriptionInvoiceTable)
			.where(eq(subscriptionInvoiceTable.invoiceId, InvoiceId.value(invoiceId)))
			.limit(1),
	);
	if (loaded.tag === "err") return loaded;
	const rows = loaded.value;
	const row = rows[0];
	if (!row || row.accountId !== AccountId.value(accountId)) return ok(null);
	return StoredInvoice.decode(row);
};

/** 申し込み結果をストアへ反映する。 */
export const saveApplied = (applied: Applied): AsyncResult<void, StoreError> =>
	matchChoice<Applied, AsyncResult<void, StoreError>>(applied, {
		TrialStarted: ({ account, subscription }) =>
			attempt(() =>
				db.transaction(async (tx) => {
					const values = StoredAccount.encode(account);
					await tx
						.insert(subscriptionAccountTable)
						.values(values)
						.onConflictDoUpdate({
							target: subscriptionAccountTable.accountId,
							set: { trialUsedAt: values.trialUsedAt },
						});
					const saved = await saveSubscription(tx, subscription);
					if (saved.tag === "err") throw saved.error.reason;
				}),
			),
		PaymentRequested: ({ subscription, invoice }) =>
			attempt(() =>
				db.transaction(async (tx) => {
					const savedInvoice = await saveInvoice(tx, invoice);
					if (savedInvoice.tag === "err") throw savedInvoice.error.reason;
					const savedSubscription = await saveSubscription(tx, subscription);
					if (savedSubscription.tag === "err")
						throw savedSubscription.error.reason;
				}),
			),
	});

/** プラン変更結果をストアへ反映する。 */
export const savePlanChanged = (
	planChanged: PlanChanged,
): AsyncResult<void, StoreError> =>
	matchChoice<PlanChanged, AsyncResult<void, StoreError>>(planChanged, {
		PaymentRequested: ({ subscription, invoice }) =>
			attempt(() =>
				db.transaction(async (tx) => {
					const savedInvoice = await saveInvoice(tx, invoice);
					if (savedInvoice.tag === "err") throw savedInvoice.error.reason;
					const savedSubscription = await saveSubscription(tx, subscription);
					if (savedSubscription.tag === "err")
						throw savedSubscription.error.reason;
				}),
			),
		UpgradeRequested: ({ subscription, invoice }) =>
			attempt(() =>
				db.transaction(async (tx) => {
					const savedInvoice = await saveInvoice(tx, invoice);
					if (savedInvoice.tag === "err") throw savedInvoice.error.reason;
					const savedSubscription = await saveSubscription(tx, subscription);
					if (savedSubscription.tag === "err")
						throw savedSubscription.error.reason;
				}),
			),
		PlanChangeReserved: ({ subscription }) =>
			saveSubscription(db, subscription),
	});

/** トライアル解約結果をストアへ反映する。 */
export const saveTrialCancelled = (
	result: TrialCancelled,
): AsyncResult<void, StoreError> =>
	matchChoice<TrialCancelled, AsyncResult<void, StoreError>>(result, {
		TrialCancelled: ({ subscription }) => saveSubscription(db, subscription),
	});

/** 解約予約結果をストアへ反映する。 */
export const saveCancellationReserved = (
	result: CancellationReserved,
): AsyncResult<void, StoreError> =>
	matchChoice<CancellationReserved, AsyncResult<void, StoreError>>(result, {
		CancellationReserved: ({ subscription }) =>
			saveSubscription(db, subscription),
	});

/** 支払い結果をストアへ反映する。 */
export const savePaymentSettled = (
	result: PaymentSettled,
): AsyncResult<void, StoreError> =>
	matchChoice<PaymentSettled, AsyncResult<void, StoreError>>(result, {
		PaymentSettled: ({ subscription, invoice }) =>
			attempt(() =>
				db.transaction(async (tx) => {
					const savedInvoice = await saveInvoice(tx, invoice);
					if (savedInvoice.tag === "err") throw savedInvoice.error.reason;
					const savedSubscription = await saveSubscription(tx, subscription);
					if (savedSubscription.tag === "err")
						throw savedSubscription.error.reason;
				}),
			),
	});

/** トライアル終了結果をストアへ反映する。 */
export const saveTrialEnded = (
	result: TrialEnded,
): AsyncResult<void, StoreError> =>
	matchChoice<TrialEnded, AsyncResult<void, StoreError>>(result, {
		TrialEnded: ({ subscription, invoice }) =>
			attempt(() =>
				db.transaction(async (tx) => {
					const savedInvoice = await saveInvoice(tx, invoice);
					if (savedInvoice.tag === "err") throw savedInvoice.error.reason;
					const savedSubscription = await saveSubscription(tx, subscription);
					if (savedSubscription.tag === "err")
						throw savedSubscription.error.reason;
				}),
			),
	});

/** 期間満了結果をストアへ反映する。 */
export const savePeriodEnded = (
	result: PeriodEnded,
): AsyncResult<void, StoreError> =>
	matchChoice<PeriodEnded, AsyncResult<void, StoreError>>(result, {
		SubscriptionEnded: ({ subscription }) => saveSubscription(db, subscription),
		RenewalRequested: ({ subscription, invoice }) =>
			attempt(() =>
				db.transaction(async (tx) => {
					const savedInvoice = await saveInvoice(tx, invoice);
					if (savedInvoice.tag === "err") throw savedInvoice.error.reason;
					const savedSubscription = await saveSubscription(tx, subscription);
					if (savedSubscription.tag === "err")
						throw savedSubscription.error.reason;
				}),
			),
	});
