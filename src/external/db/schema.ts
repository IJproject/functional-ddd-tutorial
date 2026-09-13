// ===========================================================================
// 永続化スキーマ
// ===========================================================================
//
// この層の型はドメインの型とは別物で、変換は translate.ts が担う。
// 変更したら `npm run db:generate` → `npm run db:migrate` を実行する。
//
// 前半は better-auth（auth BC）、後半は subscription BC のテーブル。所有者が違う。
//
// ---------------------------------------------------------------------------
// better-auth が必須とするテーブル
// ---------------------------------------------------------------------------
//
// 列の要件は better-auth 側で決まっているため、ここは「設計」ではなく「追随」。
// 勝手に列を足したり型を変えたりしない。雛形は次で再生成できる。
//   npx @better-auth/cli@latest generate --config src/external/better-auth/auth.ts
//
// auth.ts の drizzleAdapter は `schema[テーブル名]` で解決するため、export 名とテーブル名を一致させる。

import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

/**
 * 認証方式ごとのレコード。emailAndPassword の場合はここの `password` に
 * ハッシュ済みパスワードが入る（アプリ側で触らない）。
 */
export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

// ===========================================================================
// subscription BC の永続化
// ===========================================================================
//
// ここから下は subscription BC の関心事で、上の better-auth 4テーブルとは所有者が違う。
//
// **BC 間の結合は識別子1本に絞ってある。** subscription_account の主キーは
// auth BC の user.id と同じ値を持つ（境界層の toAccountId が翻訳する）。
// 参照は subscription → auth の片方向だけで、user 側から subscription を参照しない。
// auth BC は subscription の存在を知るべきでないため。
//
// **状態は「型を真実の源」とし、DB に CHECK 制約を置かない。**
// 「trial なのに period_ends_at が入っている」ような行を DB は拒否しないが、
// 書き手はアプリ1つだけで、保存は Subscription 型しか受け取らないため不正な行は作れない。
// 読み取り側（translate.ts）が列の NULL を検査し、解釈できなければ Result で失敗させる。
// 制約を2箇所に書くと、状態を足したときに SQL 側の追随漏れが静かに通るため、
// 守る場所を境界層に一本化している。
//
// 同じ理由で status / purpose を pgEnum にしていない。列挙をここに書くと
// ドメインの union の写しになり、状態を足すたびにマイグレーションが要る。

/**
 * 契約者。ドメインの Account（TrialUnusedAccount | TrialUsedAccount）に対応する。
 *
 * 2つの Case の判別子は `trial_used_at` の NULL 有無。status 列を持たせるまでもないので、
 * nullability そのものを判別に使う。
 *
 * 請求先住所や支払い方法の列は持たない。設定する手段も、値を見て分岐する業務ルールも
 * 無く、ドメインが運ぶだけの配管になっていたため外した。必要になった時点で、
 * その時のルールに合う形で入れ直す。
 */
export const subscriptionAccount = pgTable("subscription_account", {
	accountId: text("account_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	trialUsedAt: timestamp("trial_used_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 契約の現在状態。ドメインの Subscription（7つの Case）に対応する。
 *
 * `status` はドメインの Case 名をそのまま入れる（"FreeSubscription" など）。
 * 旧実装は status 4値 + reservation 列という持ち方だったため、
 * 「アップグレード支払い待ち かつ 解約予約中」のような、ドメインに存在しない
 * 組み合わせが表現できてしまっていた。状態を7値にすることで、CHECK 制約なしに
 * その組み合わせが作れなくなる。
 *
 * 各列がどの状態で埋まるかは translate.ts が知っている（ここには書かない）。
 */
export const subscription = pgTable("subscription", {
	accountId: text("account_id")
		.primaryKey()
		.references(() => subscriptionAccount.accountId, { onDelete: "cascade" }),
	status: text("status").notNull(),
	planId: text("plan_id"),
	trialEndsAt: timestamp("trial_ends_at"),
	periodEndsAt: timestamp("period_ends_at"),
	pendingInvoiceId: text("pending_invoice_id"),
	nextPlanId: text("next_plan_id"),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

/**
 * 請求。ドメインの Invoice（UnpaidInvoice | PaidInvoice | FailedInvoice）に対応する。
 *
 * 3つの Case はフィールドが同一で、違うのは支払いの状態だけ。したがって
 * nullable な列が1つも無く、`status` だけが Case を分ける。
 * `purpose` は請求が立った理由（New / Renewal / UpgradeDifference）で、status とは別の軸。
 */
export const subscriptionInvoice = pgTable(
	"subscription_invoice",
	{
		invoiceId: text("invoice_id").primaryKey(),
		accountId: text("account_id")
			.notNull()
			.references(() => subscriptionAccount.accountId, { onDelete: "cascade" }),
		planId: text("plan_id").notNull(),
		amount: integer("amount").notNull(),
		purpose: text("purpose").notNull(),
		status: text("status").notNull(),
		issuedAt: timestamp("issued_at").notNull(),
	},
	(table) => [
		// 請求一覧は新しい順に引くため。
		index("subscription_invoice_account_issued_idx").on(
			table.accountId,
			table.issuedAt,
		),
	],
);

export const subscriptionAccountRelations = relations(
	subscriptionAccount,
	({ one, many }) => ({
		user: one(user, {
			fields: [subscriptionAccount.accountId],
			references: [user.id],
		}),
		subscription: one(subscription),
		invoices: many(subscriptionInvoice),
	}),
);

export const subscriptionRelations = relations(subscription, ({ one }) => ({
	account: one(subscriptionAccount, {
		fields: [subscription.accountId],
		references: [subscriptionAccount.accountId],
	}),
}));

export const subscriptionInvoiceRelations = relations(
	subscriptionInvoice,
	({ one }) => ({
		account: one(subscriptionAccount, {
			fields: [subscriptionInvoice.accountId],
			references: [subscriptionAccount.accountId],
		}),
	}),
);
