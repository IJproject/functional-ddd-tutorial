import type { Primitive } from "#/domain/building-blocks";

export type MonthlyPrice = Primitive<"MonthlyPrice", number>;
export const MonthlyPrice = {
	create: (input: number): MonthlyPrice => input as MonthlyPrice,
	value: (monthlyPrice: MonthlyPrice): number => monthlyPrice,
};

export type PlanName = Primitive<"PlanName", string>;
export const PlanName = {
	/** 信頼境界の内側（料金表）からの値なので検証しない。 */
	create: (input: string): PlanName => input as PlanName,
	value: (planName: PlanName): string => planName,
};
