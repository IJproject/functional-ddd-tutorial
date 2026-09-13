import type { NonEmptyArray } from "#/domain/building-blocks";
import {
	MonthlyPrice,
	type PlanId,
	PlanId as PlanIdValue,
} from "#/domain/subscription/model/plan.primitive";

// ===========================================================================
// 型定義
// ===========================================================================

export type Plan = {
	id: PlanId;
	monthlyPrice: MonthlyPrice;
};

// ===========================================================================
// 実装
// ===========================================================================

/**
 * 料金表。ドメインが持つのは識別子と金額だけで、表示名は境界層が与える。
 * 無料の契約は PlanId として存在せず、FreeSubscription という状態で表す。
 */
const CATALOG = {
	Basic: 980,
	Pro: 2980,
} as const satisfies Record<"Basic" | "Pro", number>;

export const Plan = {
	of: (planId: PlanId): Plan => ({
		id: planId,
		monthlyPrice: MonthlyPrice.create(CATALOG[PlanIdValue.value(planId)]),
	}),

	/** 申し込み可能なプランの一覧。 */
	all: (): NonEmptyArray<Plan> => [
		Plan.of(PlanIdValue.create("Basic")),
		Plan.of(PlanIdValue.create("Pro")),
	],

	/**
	 * 上位プランへの変更で請求する差額。
	 * 同額または下位への変更では 0 以下になるので、呼び出し側が
	 * アップグレードかどうかを判定してから使う。
	 */
	priceDifference: (from: PlanId, to: PlanId): number =>
		CATALOG[PlanIdValue.value(to)] - CATALOG[PlanIdValue.value(from)],
};
