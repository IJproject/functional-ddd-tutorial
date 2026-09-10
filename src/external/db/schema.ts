// Drizzle スキーマ定義（設計はこれから）。
//
// better-auth（emailAndPassword）が必須とするテーブル: user / session / account / verification。
// 列の要件は better-auth 側で決まっているため、雛形は次で生成できる。
//   npx @better-auth/cli@latest generate
// テーブルを定義したら `npm run db:generate` → `npm run db:migrate` で DB が使える状態になる。
// auth.ts の drizzleAdapter は `schema[テーブル名]` で解決するので、export 名とテーブル名を一致させる。

export {};
