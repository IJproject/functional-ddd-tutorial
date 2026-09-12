import type { Primitive } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

export type LoggedOutAt = Primitive<"LoggedOutAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const LoggedOutAt = {
	create: (input: Date): LoggedOutAt => input as LoggedOutAt,
	value: (loggedOutAt: LoggedOutAt): Date => loggedOutAt,
};
