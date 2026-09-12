import {
	brandPrimitive,
	type Primitive,
	type Unbranded,
} from "#/domain/building-blocks";

// ===========================================================================
// 型定義（仕様）
// ===========================================================================

export type LoggedOutAt = Primitive<"LoggedOutAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const LoggedOutAt = {
	create: (input: Unbranded<Date>): LoggedOutAt =>
		brandPrimitive<LoggedOutAt>(input),
	value: (loggedOutAt: LoggedOutAt): Date => loggedOutAt,
};
