import { err, ok, type Primitive, type Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

export type RawPassword = Primitive<"RawPassword", string>;
export type LoggedInAt = Primitive<"LoggedInAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

/**
 * ログインは既存の資格情報の「照合」であって強度ポリシーの適用ではない。
 * したがって長さや文字種は検証せず、空でないことだけを見る。
 */
export const createRawPassword = (
	input: string,
): Result<RawPassword, string> =>
	input === "" ? err("パスワードを入力してください") : ok(input as RawPassword);

export const toLoggedInAt = (value: Date): LoggedInAt => value as LoggedInAt;
