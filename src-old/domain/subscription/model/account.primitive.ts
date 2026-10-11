import type { Primitive } from "#/domain/building-blocks";

export type AccountId = Primitive<"AccountId", string>;
export const AccountId = {
	create: (input: string): AccountId => input as AccountId,
	value: (accountId: AccountId): string => accountId,
};

export type TrialUsedAt = Primitive<"TrialUsedAt", Date>;
export const TrialUsedAt = {
	create: (input: Date): TrialUsedAt => input as TrialUsedAt,
	value: (trialUsedAt: TrialUsedAt): Date => trialUsedAt,
};
