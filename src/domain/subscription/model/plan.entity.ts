import type { Case, NonEmptyArray } from "#/domain/building-blocks";
import { Amount } from "#/domain/subscription/model/invoice.primitive";
import type { PlanId } from "#/domain/subscription/model/plan.model";
import {
	MonthlyPrice,
	PlanName,
} from "#/domain/subscription/model/plan.primitive";

// ===========================================================================
// 型定義
// ===========================================================================

export type Plan = {
	id: PlanId;
	name: PlanName;
	monthlyPrice: MonthlyPrice;
};

/**
 * プラン変更の向き。差額が正なら請求が必要なアップグレード、
 * 同額または下位なら期間満了時の切り替えになる。
 */
export type PlanChange =
	| Case<"Upgrade", { difference: Amount }>
	| Case<"Downgrade">;

// ===========================================================================
// 実装
// ===========================================================================

/**
 * 料金表。識別子・表示名・金額を一体で持つ。
 * 名前を境界層に置くと複数の dto に重複し、プランを足したとき直し漏れるため、ここで持つ。
 */
const CATALOG = {
	Basic: { name: "ベーシック", monthlyPrice: 980 },
	Pro: { name: "プロ", monthlyPrice: 2980 },
} as const satisfies Record<
	PlanId["kind"],
	{ name: string; monthlyPrice: number }
>;

export const Plan = {
	of: (planId: PlanId): Plan => ({
		id: planId,
		name: PlanName.create(CATALOG[planId.kind].name),
		monthlyPrice: MonthlyPrice.create(CATALOG[planId.kind].monthlyPrice),
	}),

	/** 申し込み可能なプランの一覧。 */
	all: (): NonEmptyArray<Plan> => [
		Plan.of({ kind: "Basic" }),
		Plan.of({ kind: "Pro" }),
	],

	change: (from: PlanId, to: PlanId): PlanChange => {
		const difference =
			CATALOG[to.kind].monthlyPrice - CATALOG[from.kind].monthlyPrice;
		return difference > 0
			? { kind: "Upgrade", difference: Amount.create(difference) }
			: { kind: "Downgrade" };
	},
};
