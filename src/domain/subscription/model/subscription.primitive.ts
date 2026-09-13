import type { Primitive } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type TrialEndsAt = Primitive<"TrialEndsAt", Date>;
export type PeriodEndsAt = Primitive<"PeriodEndsAt", Date>;

// ===========================================================================
// 実装
// ===========================================================================

export const TrialEndsAt = {
	create: (input: Date): TrialEndsAt => input as TrialEndsAt,
	value: (trialEndsAt: TrialEndsAt): Date => trialEndsAt,
};

export const PeriodEndsAt = {
	create: (input: Date): PeriodEndsAt => input as PeriodEndsAt,
	value: (periodEndsAt: PeriodEndsAt): Date => periodEndsAt,
};
