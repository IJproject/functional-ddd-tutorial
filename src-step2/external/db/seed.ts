// 開発用の請求。再実行すると入れ直す。
import { db } from "./client.ts";
import { subscriptionInvoiceTable } from "./schema.ts";

const INVOICES = [
	{
		invoiceId: "INV-12345678-6",
		amount: 1980,
		issuedAt: new Date("2026-10-11T13:00:00+09:00"),
	},
	{
		invoiceId: "INV-00000001-1",
		amount: 3980,
		issuedAt: new Date("2026-09-11T09:30:00+09:00"),
	},
];

await db.delete(subscriptionInvoiceTable);
await db.insert(subscriptionInvoiceTable).values(INVOICES);
await db.$client.end();
