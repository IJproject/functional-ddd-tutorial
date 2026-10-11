import type { Primitive } from "#/domain/building-blocks";

export type LoggedInAt = Primitive<"LoggedInAt", Date>;
export const LoggedInAt = {
	create: (input: Date): LoggedInAt => input as LoggedInAt,
	value: (loggedInAt: LoggedInAt): Date => loggedInAt,
};
