import type { Primitive } from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

export type LoggedOutAt = Primitive<"LoggedOutAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const toLoggedOutAt = (value: Date): LoggedOutAt => value as LoggedOutAt;
