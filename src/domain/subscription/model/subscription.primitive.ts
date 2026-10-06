import type { Primitive } from "#/domain/building-blocks";
import { TrialUsedAt } from "#/domain/subscription/model/account.primitive";
import { PaidAt } from "#/domain/subscription/model/invoice.primitive";

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

/** 無料トライアルの日数。 */
const TRIAL_DAYS = 14;

/** トライアル期間の終わり。使い始めた時刻から TRIAL_DAYS 後。 */
export const trialPeriodEnd = (trialUsedAt: TrialUsedAt): TrialEndsAt =>
	TrialEndsAt.create(
		new Date(
			TrialUsedAt.value(trialUsedAt).getTime() +
				TRIAL_DAYS * 24 * 60 * 60 * 1000,
		),
	);

/** 契約期間の終わり。支払いが成立した時刻から1ヶ月後。 */
export const billingPeriodEnd = (paidAt: PaidAt): PeriodEndsAt => {
	const paid = PaidAt.value(paidAt);
	return PeriodEndsAt.create(
		new Date(
			paid.getFullYear(),
			paid.getMonth() + 1,
			paid.getDate(),
			paid.getHours(),
			paid.getMinutes(),
			paid.getSeconds(),
			paid.getMilliseconds(),
		),
	);
};
