import {
	boolean,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

/** 請求。契約やアカウントとのつながりは、それらを扱う段で足す。 */
export const subscriptionInvoiceTable = pgTable("subscription_invoice", {
	invoiceId: text("invoice_id").primaryKey(),
	amount: integer("amount").notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
});

// better-auth が必須とする表。列は better-auth の要件に従い、勝手に足したり型を変えたりしない。
// auth.ts で generateId: "serial" にしているので、id は DB の自動採番（整数）。
// better-auth は起動のときに表と列がそろっているかを確かめるので、
// このアプリで使わない列（user の image、session の端末の記録、account の SNS ログイン用のトークン）や
// verification の表も置く。値は入らない。
// auth.ts の drizzleAdapter は表を export 名で探すので、export 名は better-auth のモデル名（user など）にする。

export const user = pgTable("user", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	// メールアドレスの持ち主だと確かめ終えたか。確認メールは送らないので、常に false
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
		id: serial("id").primaryKey(),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at").notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: integer("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

/** ログインの手段。メールとパスワードの場合は providerId が "credential" で、password にハッシュが入る。 */
export const account = pgTable(
	"account",
	{
		id: serial("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: integer("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		password: text("password"),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable("verification", {
	id: serial("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});
