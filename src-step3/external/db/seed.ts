// 開発用のデータ。再実行すると入れ直す。
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "./client.ts";
import { account, subscriptionInvoiceTable, user } from "./schema.ts";

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

// ログインを試すための利用者。新規登録を作るまでは、ここで入れる
const DEMO_USER = {
	name: "デモ利用者",
	email: "demo@example.com",
	password: "password123",
};

// 同じメールアドレスの利用者を消してから入れ直す。account は外部キーの cascade で一緒に消える
await db.delete(user).where(eq(user.email, DEMO_USER.email));
const [inserted] = await db
	.insert(user)
	.values({ name: DEMO_USER.name, email: DEMO_USER.email })
	.returning({ id: user.id });
await db.insert(account).values({
	accountId: String(inserted.id),
	providerId: "credential",
	userId: inserted.id,
	password: await hashPassword(DEMO_USER.password),
	updatedAt: new Date(),
});

await db.$client.end();
