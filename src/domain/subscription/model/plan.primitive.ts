import type { Primitive } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

export type PlanId = Primitive<"PlanId", "Basic" | "Pro">;
export type MonthlyPrice = Primitive<"MonthlyPrice", number>;

// ===========================================================================
// 実装
// ===========================================================================

export const PlanId = {
	/** 信頼境界の内側の値からの変換。リテラル型で絞っているので失敗しない。 */
	create: (input: "Basic" | "Pro"): PlanId => input as PlanId,
	value: (planId: PlanId): "Basic" | "Pro" => planId,
};

export const MonthlyPrice = {
	create: (input: number): MonthlyPrice => input as MonthlyPrice,
	value: (monthlyPrice: MonthlyPrice): number => monthlyPrice,
};
