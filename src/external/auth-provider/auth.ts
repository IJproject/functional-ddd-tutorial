import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "#/external/db/client";
import * as schema from "#/external/db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "pg", schema }),
	emailAndPassword: { enabled: true },
	// 利用者などの ID を、DB の自動採番（1, 2, 3, …）にする
	advanced: { database: { generateId: "serial" } },
	// サーバー関数の中でログインしたとき、セッションの Cookie をブラウザに返すため
	plugins: [tanstackStartCookies()],
});
