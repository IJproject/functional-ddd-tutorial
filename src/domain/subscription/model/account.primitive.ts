import type { Primitive } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type AccountId = Primitive<"AccountId", string>;
export type TrialUsedAt = Primitive<"TrialUsedAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const AccountId = {
	create: (input: string): AccountId => input as AccountId,
	value: (accountId: AccountId): string => accountId,
};

export const TrialUsedAt = {
	create: (input: Date): TrialUsedAt => input as TrialUsedAt,
	value: (trialUsedAt: TrialUsedAt): Date => trialUsedAt,
};
