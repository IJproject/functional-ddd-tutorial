import type { Primitive } from "#/domain/building-blocks";

export type LoggedOutAt = Primitive<"LoggedOutAt", Date>;
export const LoggedOutAt = {
	create: (input: Date): LoggedOutAt => input as LoggedOutAt,
	value: (loggedOutAt: LoggedOutAt): Date => loggedOutAt,
};
