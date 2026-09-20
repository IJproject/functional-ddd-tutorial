// ===========================================================================
// 開発用 seed
// ===========================================================================
//
// 開発時の動作確認専用。本番では実行しない。
// seed はドメインの型で定義し、DB 行への変換は translate.ts に任せる。
// 契約状態を追加したとき、seed の追随漏れを型エラーで検知するためである。
//
// 再実行時は @seed.local のアカウントだけを削除して作り直す。
// 手で作ったアカウントは削除しない。user を消せば、契約と請求は
// 外部キーの cascade で一緒に消える。
//
// ユーザーの作成に auth.api.signUpEmail は使わない。あれは登録と同時に
// セッション Cookie を発行するため HTTP のリクエスト文脈を要求し、
// スクリプトからは呼べないためである。代わりに better-auth の
// hashPassword でハッシュだけ作り、user と account の行を直に入れる。
// ハッシュの形式は better-auth が認証時に使うものと同じなので、
// この行でそのままログインできる。
//
// 識別子は UUID ではなく "seed-<用途>" の固定値にしている。再実行しても
// 同じ値になり、DB を直接覗いたときにどのアカウントの行か分かるため。
// 各識別子は slug から導出し、定義の中では文字列を組み立て直さない。
// 同じアカウントの ID を別々に書くと、型が通っても他アカウントの請求に
// なり得るためである。支払い待ちの参照には、請求配列へ入れる
// 請求オブジェクトそのものの id を使う。

import { hashPassword } from "better-auth/crypto";
import { like } from "drizzle-orm";
import {
	EmailAddress,
	type EmailAddressError,
	UserId,
} from "#/domain/auth/model/user.primitive";
import { UserName } from "#/domain/auth/operation/signup/signup.primitive";
import {
	type Primitive,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import { Account } from "#/domain/subscription/model/account.entity";
import {
	AccountId,
	TrialUsedAt,
} from "#/domain/subscription/model/account.primitive";
import {
	Invoice,
	InvoicePurpose,
} from "#/domain/subscription/model/invoice.entity";
import {
	Amount,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { PlanId } from "#/domain/subscription/model/plan.primitive";
import { Subscription } from "#/domain/subscription/model/subscription.entity";
import {
	PeriodEndsAt,
	TrialEndsAt,
} from "#/domain/subscription/model/subscription.primitive";
import { db } from "#/external/db/client";
import {
	account as accountTable,
	subscriptionAccount as subscriptionAccountTable,
	subscriptionInvoice as subscriptionInvoiceTable,
	subscription as subscriptionTable,
	user as userTable,
} from "#/external/db/schema";
import {
	toStoredAccount,
	toStoredInvoice,
	toStoredSubscription,
} from "#/external/subscription-store/translate";

const SEED_EMAIL_DOMAIN = "seed.local";
const SEED_PASSWORD = "password";
const now = new Date();

const daysFromNow = (days: number): Date =>
	new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
const daysAgo = (days: number): Date => daysFromNow(-days);

/** seed アカウントを識別する短い名前。id やメールアドレスの素になる。 */
type SeedSlug = Primitive<"SeedSlug", string>;
/** 画面で何を確認できるかの説明。実行時のログにだけ使う。 */
type SeedNote = Primitive<"SeedNote", string>;
/** better-auth の account 行の id。ドメインの概念ではない。 */
type SeedCredentialId = Primitive<"SeedCredentialId", string>;

const SeedSlug = {
	create: (input: string): SeedSlug => input as SeedSlug,
	value: (slug: SeedSlug): string => slug,

	/** user.id と subscription_account.account_id に入る値。 */
	toUserId: (slug: SeedSlug): UserId =>
		UserId.create(`seed-${SeedSlug.value(slug)}`),
	/** better-auth の account 行の id。 */
	toCredentialId: (slug: SeedSlug): SeedCredentialId =>
		SeedCredentialId.create(`seed-cred-${SeedSlug.value(slug)}`),
	/** ログインに使うメールアドレス。 */
	toEmail: (slug: SeedSlug): ResultType<EmailAddress, EmailAddressError> =>
		EmailAddress.create(`${SeedSlug.value(slug)}@${SEED_EMAIL_DOMAIN}`),
	/** 連番から請求の id を作る。 */
	toInvoiceId: (slug: SeedSlug, sequence: number): InvoiceId =>
		InvoiceId.create(`seed-inv-${SeedSlug.value(slug)}-${sequence}`),
};

const SeedNote = {
	create: (input: string): SeedNote => input as SeedNote,
	value: (note: SeedNote): string => note,
};

const SeedCredentialId = {
	create: (input: string): SeedCredentialId => input as SeedCredentialId,
	value: (credentialId: SeedCredentialId): string => credentialId,
};

/** seed の構築失敗はプログラマのミスなので、その場で落とす。 */
const must = <T, E>(label: string, result: ResultType<T, E>): T =>
	Result.match(result, {
		ok: (value) => value,
		err: (error) => {
			throw new Error(
				`${label} の構築に失敗しました: ${JSON.stringify(error)}`,
			);
		},
	});

/** auth BC の利用者 ID を subscription BC の契約者 ID に翻訳する。 */
const toAccountId = (userId: UserId): AccountId =>
	AccountId.create(UserId.value(userId));

type SeedContext = {
	accountId: AccountId;
	invoiceId: (sequence: number) => InvoiceId;
};

type SeedDefinition = {
	name: UserName;
	note: SeedNote;
	account: Account;
	subscription: Subscription;
	invoices: readonly Invoice[];
};

type SeedAccount = SeedDefinition & {
	/** user.id と subscription_account.account_id に入る固定値。 */
	id: UserId;
	credentialId: SeedCredentialId;
	email: EmailAddress;
};

const defineSeedAccount = (
	slug: SeedSlug,
	define: (context: SeedContext) => SeedDefinition,
): SeedAccount => {
	const id = SeedSlug.toUserId(slug);
	const accountId = toAccountId(id);
	const invoiceId = (sequence: number): InvoiceId =>
		SeedSlug.toInvoiceId(slug, sequence);

	return {
		id,
		credentialId: SeedSlug.toCredentialId(slug),
		email: must("メールアドレス", SeedSlug.toEmail(slug)),
		...define({ accountId, invoiceId }),
	};
};

const SEED_ACCOUNTS: readonly SeedAccount[] = [
	defineSeedAccount(SeedSlug.create("free-fresh"), ({ accountId }) => ({
		name: must("表示名", UserName.create("無料 / トライアル未使用")),
		note: SeedNote.create("申し込むとトライアルが始まる"),
		account: Account.trialUnused(accountId),
		subscription: Subscription.free(accountId),
		invoices: [],
	})),
	defineSeedAccount(
		SeedSlug.create("free-used"),
		({ accountId, invoiceId }) => ({
			name: must("表示名", UserName.create("無料 / トライアル使用済み")),
			note: SeedNote.create("申し込むと支払い待ちになる"),
			account: Account.trialUsed({
				id: accountId,
				trialUsedAt: TrialUsedAt.create(daysAgo(40)),
			}),
			subscription: Subscription.free(accountId),
			invoices: [
				must(
					"請求",
					Invoice.paid({
						id: invoiceId(1),
						accountId,
						planId: PlanId.create("Basic"),
						amount: Amount.create(980),
						purpose: InvoicePurpose.New,
						issuedAt: IssuedAt.create(daysAgo(45)),
					}),
				),
			],
		}),
	),
	defineSeedAccount(SeedSlug.create("trial"), ({ accountId }) => ({
		name: must("表示名", UserName.create("トライアル中 / Basic")),
		note: SeedNote.create("トライアル終了までの日数を確認できる"),
		account: Account.trialUsed({
			id: accountId,
			trialUsedAt: TrialUsedAt.create(daysAgo(4)),
		}),
		subscription: Subscription.trial({
			accountId,
			planId: PlanId.create("Basic"),
			trialEndsAt: TrialEndsAt.create(daysFromNow(10)),
		}),
		invoices: [],
	})),
	defineSeedAccount(SeedSlug.create("pending"), ({ accountId, invoiceId }) => {
		const pendingInvoice = must(
			"請求",
			Invoice.unpaid({
				id: invoiceId(1),
				accountId,
				planId: PlanId.create("Pro"),
				amount: Amount.create(2980),
				purpose: InvoicePurpose.New,
				issuedAt: IssuedAt.create(daysAgo(1)),
			}),
		);

		return {
			name: must("表示名", UserName.create("支払い待ち / Pro")),
			note: SeedNote.create("支払いに成功・失敗させられる"),
			account: Account.trialUsed({
				id: accountId,
				trialUsedAt: TrialUsedAt.create(daysAgo(20)),
			}),
			subscription: Subscription.pendingPayment({
				accountId,
				planId: PlanId.create("Pro"),
				pendingInvoiceId: pendingInvoice.id,
			}),
			invoices: [pendingInvoice],
		};
	}),
	defineSeedAccount(
		SeedSlug.create("paid-basic"),
		({ accountId, invoiceId }) => ({
			name: must("表示名", UserName.create("契約中 / Basic")),
			note: SeedNote.create("契約中の表示と請求履歴を確認できる"),
			account: Account.trialUsed({
				id: accountId,
				trialUsedAt: TrialUsedAt.create(daysAgo(50)),
			}),
			subscription: Subscription.paid({
				accountId,
				planId: PlanId.create("Basic"),
				periodEndsAt: PeriodEndsAt.create(daysFromNow(20)),
			}),
			invoices: [
				must(
					"請求",
					Invoice.paid({
						id: invoiceId(1),
						accountId,
						planId: PlanId.create("Basic"),
						amount: Amount.create(980),
						purpose: InvoicePurpose.New,
						issuedAt: IssuedAt.create(daysAgo(40)),
					}),
				),
				must(
					"請求",
					Invoice.paid({
						id: invoiceId(2),
						accountId,
						planId: PlanId.create("Basic"),
						amount: Amount.create(980),
						purpose: InvoicePurpose.Renewal,
						issuedAt: IssuedAt.create(daysAgo(10)),
					}),
				),
				must(
					"請求",
					Invoice.failed({
						id: invoiceId(3),
						accountId,
						planId: PlanId.create("Basic"),
						amount: Amount.create(980),
						purpose: InvoicePurpose.Renewal,
						issuedAt: IssuedAt.create(daysAgo(35)),
					}),
				),
			],
		}),
	),
	defineSeedAccount(
		SeedSlug.create("paid-pro"),
		({ accountId, invoiceId }) => ({
			name: must("表示名", UserName.create("契約中 / Pro")),
			note: SeedNote.create("Pro 契約中の表示を確認できる"),
			account: Account.trialUsed({
				id: accountId,
				trialUsedAt: TrialUsedAt.create(daysAgo(70)),
			}),
			subscription: Subscription.paid({
				accountId,
				planId: PlanId.create("Pro"),
				periodEndsAt: PeriodEndsAt.create(daysFromNow(25)),
			}),
			invoices: [
				must(
					"請求",
					Invoice.paid({
						id: invoiceId(1),
						accountId,
						planId: PlanId.create("Pro"),
						amount: Amount.create(2980),
						purpose: InvoicePurpose.New,
						issuedAt: IssuedAt.create(daysAgo(5)),
					}),
				),
			],
		}),
	),
	defineSeedAccount(SeedSlug.create("upgrade"), ({ accountId, invoiceId }) => {
		const paidInvoice = must(
			"請求",
			Invoice.paid({
				id: invoiceId(1),
				accountId,
				planId: PlanId.create("Basic"),
				amount: Amount.create(980),
				purpose: InvoicePurpose.New,
				issuedAt: IssuedAt.create(daysAgo(15)),
			}),
		);
		const pendingInvoice = must(
			"請求",
			Invoice.unpaid({
				id: invoiceId(2),
				accountId,
				planId: PlanId.create("Pro"),
				amount: Amount.create(2000),
				purpose: InvoicePurpose.UpgradeDifference,
				issuedAt: IssuedAt.create(now),
			}),
		);

		return {
			name: must(
				"表示名",
				UserName.create("アップグレード支払い待ち / Basic → Pro"),
			),
			note: SeedNote.create("差額請求の支払いに成功・失敗させられる"),
			account: Account.trialUsed({
				id: accountId,
				trialUsedAt: TrialUsedAt.create(daysAgo(60)),
			}),
			subscription: Subscription.upgradePending({
				accountId,
				planId: PlanId.create("Basic"),
				periodEndsAt: PeriodEndsAt.create(daysFromNow(15)),
				pendingInvoiceId: pendingInvoice.id,
			}),
			invoices: [paidInvoice, pendingInvoice],
		};
	}),
	defineSeedAccount(SeedSlug.create("cancel"), ({ accountId, invoiceId }) => ({
		name: must("表示名", UserName.create("解約予約中 / Pro")),
		note: SeedNote.create("契約期間終了後の解約予約を確認できる"),
		account: Account.trialUsed({
			id: accountId,
			trialUsedAt: TrialUsedAt.create(daysAgo(90)),
		}),
		subscription: Subscription.cancelReserved({
			accountId,
			planId: PlanId.create("Pro"),
			periodEndsAt: PeriodEndsAt.create(daysFromNow(12)),
		}),
		invoices: [
			must(
				"請求",
				Invoice.paid({
					id: invoiceId(1),
					accountId,
					planId: PlanId.create("Pro"),
					amount: Amount.create(2980),
					purpose: InvoicePurpose.Renewal,
					issuedAt: IssuedAt.create(daysAgo(18)),
				}),
			),
		],
	})),
	defineSeedAccount(SeedSlug.create("change"), ({ accountId, invoiceId }) => ({
		name: must("表示名", UserName.create("プラン変更予約中 / Pro → Basic")),
		note: SeedNote.create("次回更新時の Basic への変更予約を確認できる"),
		account: Account.trialUsed({
			id: accountId,
			trialUsedAt: TrialUsedAt.create(daysAgo(100)),
		}),
		subscription: Subscription.planChangeReserved({
			accountId,
			planId: PlanId.create("Pro"),
			periodEndsAt: PeriodEndsAt.create(daysFromNow(8)),
			nextPlanId: PlanId.create("Basic"),
		}),
		invoices: [
			must(
				"請求",
				Invoice.paid({
					id: invoiceId(1),
					accountId,
					planId: PlanId.create("Pro"),
					amount: Amount.create(2980),
					purpose: InvoicePurpose.Renewal,
					issuedAt: IssuedAt.create(daysAgo(22)),
				}),
			),
		],
	})),
];

const main = async (): Promise<void> => {
	const deletedUsers = await db
		.delete(userTable)
		.where(like(userTable.email, `%@${SEED_EMAIL_DOMAIN}`))
		.returning({ id: userTable.id });
	console.log(`既存 seed アカウントを ${deletedUsers.length} 件削除しました。`);

	const passwordHash = await hashPassword(SEED_PASSWORD);

	await db.transaction(async (tx) => {
		for (const seedAccount of SEED_ACCOUNTS) {
			await tx.insert(userTable).values({
				id: UserId.value(seedAccount.id),
				name: UserName.value(seedAccount.name),
				email: EmailAddress.value(seedAccount.email),
				emailVerified: true,
				createdAt: now,
				updatedAt: now,
			});
			await tx.insert(accountTable).values({
				id: SeedCredentialId.value(seedAccount.credentialId),
				accountId: UserId.value(seedAccount.id),
				providerId: "credential",
				userId: UserId.value(seedAccount.id),
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			});
			await tx.insert(subscriptionAccountTable).values({
				...toStoredAccount(seedAccount.account),
				createdAt: now,
			});
			await tx
				.insert(subscriptionTable)
				.values(toStoredSubscription(seedAccount.subscription));
			if (seedAccount.invoices.length > 0) {
				await tx
					.insert(subscriptionInvoiceTable)
					.values(seedAccount.invoices.map(toStoredInvoice));
			}
		}
	});

	console.table(
		SEED_ACCOUNTS.map((seedAccount) => ({
			メールアドレス: EmailAddress.value(seedAccount.email),
			契約状態: seedAccount.subscription.kind,
			確認内容: SeedNote.value(seedAccount.note),
		})),
	);
	console.log(`パスワードは全アカウント \`${SEED_PASSWORD}\``);
};

main()
	.catch((error: unknown) => {
		console.error("seed の投入に失敗しました。", error);
		process.exitCode = 1;
	})
	.finally(() => {
		process.exit(process.exitCode ?? 0);
	});
