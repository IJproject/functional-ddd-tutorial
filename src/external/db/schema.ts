import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** 請求。契約やアカウントとのつながりは、それらを扱う段で足す。 */
export const subscriptionInvoiceTable = pgTable("subscription_invoice", {
	invoiceId: text("invoice_id").primaryKey(),
	amount: integer("amount").notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
});
