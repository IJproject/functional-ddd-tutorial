import { type Case, err, ok, type Result } from "#/domain/building-blocks";

// ===========================================================================
// 型定義
// ===========================================================================

/**
 * 料金表に存在するプラン。
 * 無料の契約は PlanId として存在せず、FreeSubscription という状態で表す。
 */
export type PlanId = Case<"Basic"> | Case<"Pro">;

/** PlanId の構築が失敗する理由。文言は持たない。 */
export type PlanIdError = Case<"UnknownPlan">;

// ===========================================================================
// 実装
// ===========================================================================

/** case を網羅する。プランが増えたらここがコンパイルエラーになる。 */
const CHOICES = {
	Basic: { kind: "Basic" },
	Pro: { kind: "Pro" },
} as const satisfies { [K in PlanId["kind"]]: Extract<PlanId, { kind: K }> };

export const PlanId = {
	/** 信頼できない文字列 → ドメイン。料金表に無い識別子は UnknownPlan で弾く。 */
	create: (input: string): Result<PlanId, PlanIdError> =>
		Object.hasOwn(CHOICES, input)
			? ok(CHOICES[input as PlanId["kind"]])
			: err({ kind: "UnknownPlan" }),
};
