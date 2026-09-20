import {
	type Case,
	err,
	ok,
	type Primitive,
	type Result,
} from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type UserName = Primitive<"UserName", string>;
export type RegisteredAt = Primitive<"RegisteredAt", Date>;

/** UserName の構築が失敗する理由。文言は持たない。 */
export type UserNameError = Case<"Empty">;

// ===========================================================================
// 実装
// ===========================================================================

export const UserName = {
	/** 表示名。空でないことだけを見る（フォームの制約が required のみのため）。 */
	create: (input: string): Result<UserName, UserNameError> => {
		const trimmed = input.trim();
		return trimmed === "" ? err({ kind: "Empty" }) : ok(trimmed as UserName);
	},
	value: (userName: UserName): string => userName,
};

export const RegisteredAt = {
	create: (input: Date): RegisteredAt => input as RegisteredAt,
	value: (registeredAt: RegisteredAt): Date => registeredAt,
};
