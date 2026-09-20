import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { StoreError } from "#/domain/subscription/model/store.model";
import type {
	EndPeriodError,
	EndTrialError,
	PeriodEnded,
	TrialEnded,
} from "#/domain/subscription/operation/schedule/schedule.model";

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** トライアル終了のドメイン結果 → ScheduleResponse。 */
export const encodeEndTrialResponse = (
	result: ResultType<TrialEnded, EndTrialError | StoreError>,
): ScheduleResponse =>
	Result.match<TrialEnded, EndTrialError | StoreError, ScheduleResponse>(
		result,
		{
			ok: () => ({ ok: true }),
			err: (error) => ({
				ok: false,
				message: matchChoice<EndTrialError | StoreError, string>(error, {
					NotInTrial: () => "トライアル中ではありません",
					MalformedSubscription: () => MALFORMED_STORED_DATA_MESSAGE,
					MalformedInvoice: () => MALFORMED_STORED_DATA_MESSAGE,
				}),
			}),
		},
	);

/** 期間満了のドメイン結果 → ScheduleResponse。 */
export const encodeEndPeriodResponse = (
	result: ResultType<PeriodEnded, EndPeriodError | StoreError>,
): ScheduleResponse =>
	Result.match<PeriodEnded, EndPeriodError | StoreError, ScheduleResponse>(
		result,
		{
			ok: () => ({ ok: true }),
			err: (error) => ({
				ok: false,
				message: matchChoice<EndPeriodError | StoreError, string>(error, {
					NotPaid: () => "有料契約中ではありません",
					PaymentPending: () =>
						"支払い待ちの請求があります。先に支払ってください",
					MalformedSubscription: () => MALFORMED_STORED_DATA_MESSAGE,
					MalformedInvoice: () => MALFORMED_STORED_DATA_MESSAGE,
				}),
			}),
		},
	);

export const UNEXPECTED_END_TRIAL_RESPONSE: Extract<
	ScheduleResponse,
	{ ok: false }
> = {
	ok: false,
	message: "操作に失敗しました",
};

export const AUTHENTICATION_REQUIRED_END_TRIAL_RESPONSE: Extract<
	ScheduleResponse,
	{ ok: false }
> = {
	ok: false,
	message: "ログインしてください",
};

export const UNEXPECTED_END_PERIOD_RESPONSE: Extract<
	ScheduleResponse,
	{ ok: false }
> = {
	ok: false,
	message: "操作に失敗しました",
};

export const AUTHENTICATION_REQUIRED_END_PERIOD_RESPONSE: Extract<
	ScheduleResponse,
	{ ok: false }
> = {
	ok: false,
	message: "ログインしてください",
};

const MALFORMED_STORED_DATA_MESSAGE = "契約情報を読み込めませんでした";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type ScheduleResponse = { ok: true } | { ok: false; message: string };
