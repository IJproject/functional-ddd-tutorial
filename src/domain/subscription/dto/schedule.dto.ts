import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	EndPeriodError,
	EndTrialError,
	PeriodEnded,
	TrialEnded,
} from "#/domain/subscription/model/schedule.model";

// ===========================================================================
// 型定義
// ===========================================================================

export type ScheduleResponse = { ok: true } | { ok: false; message: string };

// ===========================================================================
// 実装
// ===========================================================================

/** トライアル終了のドメイン結果 → ScheduleResponse。 */
export const encodeEndTrialResponse = (
	result: ResultType<TrialEnded, EndTrialError>,
): ScheduleResponse =>
	Result.match<TrialEnded, EndTrialError, ScheduleResponse>(result, {
		ok: () => ({ ok: true }),
		err: (error) => ({
			ok: false,
			message: matchChoice<EndTrialError, string>(error, {
				NotInTrial: () => "トライアル中ではありません",
			}),
		}),
	});

/** 期間満了のドメイン結果 → ScheduleResponse。 */
export const encodeEndPeriodResponse = (
	result: ResultType<PeriodEnded, EndPeriodError>,
): ScheduleResponse =>
	Result.match<PeriodEnded, EndPeriodError, ScheduleResponse>(result, {
		ok: () => ({ ok: true }),
		err: (error) => ({
			ok: false,
			message: matchChoice<EndPeriodError, string>(error, {
				NotPaid: () => "有料契約中ではありません",
				PaymentPending: () =>
					"支払い待ちの請求があります。先に支払ってください",
			}),
		}),
	});
