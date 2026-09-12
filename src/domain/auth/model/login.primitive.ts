import {
	brandPrimitive,
	err,
	ok,
	type Primitive,
	type Result,
	type Unbranded,
} from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

export type RawPassword = Primitive<"RawPassword", string>;
export type LoggedInAt = Primitive<"LoggedInAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const RawPassword = {
	/**
	 * ログインは既存の資格情報の「照合」であって強度ポリシーの適用ではない。
	 * したがって長さや文字種は検証せず、空でないことだけを見る。
	 */
	create: (input: Unbranded<string>): Result<RawPassword, string> =>
		input === ""
			? err("パスワードを入力してください")
			: ok(brandPrimitive<RawPassword>(input)),
	value: (password: RawPassword): string => password,
};

export const LoggedInAt = {
	create: (input: Unbranded<Date>): LoggedInAt =>
		brandPrimitive<LoggedInAt>(input),
	value: (loggedInAt: LoggedInAt): Date => loggedInAt,
};
