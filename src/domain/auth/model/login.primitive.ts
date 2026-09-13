import type { Primitive } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type LoggedInAt = Primitive<"LoggedInAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const LoggedInAt = {
	create: (input: Date): LoggedInAt => input as LoggedInAt,
	value: (loggedInAt: LoggedInAt): Date => loggedInAt,
};
