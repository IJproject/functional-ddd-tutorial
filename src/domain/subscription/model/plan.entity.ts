import {
	type Case,
	err,
	type NonEmptyArray,
	ok,
	type Primitive,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
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
 * 上位プランへの変更。PlanUpgrade.create を通らないと作れないので、
 * 下位・同額への組み合わせはこの型の値として存在しない。
 * 料金表の金額で判定するため、PlanId と同じ plan.model.ts ではなく料金表のあるこのファイルに置く。
 */
export type PlanUpgrade = Primitive<
	"PlanUpgrade",
	{ from: PlanId; to: PlanId }
>;

/** PlanUpgrade の構築が失敗する理由。文言は持たない。 */
export type PlanUpgradeError = Case<"NotAnUpgrade">;

/**
 * プラン変更の向き。差額が正なら請求が必要なアップグレード、
 * 同額または下位なら期間満了時の切り替えになる。
 */
export type PlanChange =
	| Case<"Upgrade", { upgrade: PlanUpgrade; difference: Amount }>
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

export const PlanUpgrade = {
	/** 変更先の月額が変更元より高いときだけ作れる。 */
	create: (fields: {
		from: PlanId;
		to: PlanId;
	}): ResultType<PlanUpgrade, PlanUpgradeError> =>
		CATALOG[fields.to.kind].monthlyPrice >
		CATALOG[fields.from.kind].monthlyPrice
			? ok(fields as PlanUpgrade)
			: err({ kind: "NotAnUpgrade" }),
};

/** アップグレードの差額。PlanUpgrade は上位への変更しか表さないので、必ず正になる。 */
export const upgradeDifference = (upgrade: PlanUpgrade): Amount =>
	Amount.create(
		CATALOG[upgrade.to.kind].monthlyPrice -
			CATALOG[upgrade.from.kind].monthlyPrice,
	);

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

	change: (from: PlanId, to: PlanId): PlanChange =>
		Result.match<PlanUpgrade, PlanUpgradeError, PlanChange>(
			PlanUpgrade.create({ from, to }),
			{
				ok: (upgrade) => ({
					kind: "Upgrade",
					upgrade,
					difference: upgradeDifference(upgrade),
				}),
				err: () => ({ kind: "Downgrade" }),
			},
		),
};
