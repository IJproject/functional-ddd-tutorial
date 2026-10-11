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

/** トライアル終了のドメイン結果 → EndTrialResponse。 */
export const EndTrialResponse = {
	encode: (
		result: ResultType<TrialEnded, EndTrialError | StoreError>,
	): EndTrialResponse =>
		Result.match<TrialEnded, EndTrialError | StoreError, EndTrialResponse>(
			result,
			{
				ok: () => ({ ok: true }),
				err: (error) => ({
					ok: false,
					message: matchChoice<EndTrialError | StoreError, string>(error, {
						NotInTrial: () => "トライアル中ではありません",
						MalformedSubscription: () => MALFORMED_STORED_DATA_MESSAGE,
						MalformedInvoice: () => MALFORMED_STORED_DATA_MESSAGE,
						StoreUnavailable: () => STORE_UNAVAILABLE_MESSAGE,
					}),
				}),
			},
		),
	unexpected: {
		ok: false,
		message: "操作に失敗しました",
	} satisfies Extract<EndTrialResponse, { ok: false }>,
	authenticationRequired: {
		ok: false,
		message: "ログインしてください",
	} satisfies Extract<EndTrialResponse, { ok: false }>,
};

/** 期間満了のドメイン結果 → EndPeriodResponse。 */

export const EndPeriodResponse = {
	encode: (
		result: ResultType<PeriodEnded, EndPeriodError | StoreError>,
	): EndPeriodResponse =>
		Result.match<PeriodEnded, EndPeriodError | StoreError, EndPeriodResponse>(
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
						StoreUnavailable: () => STORE_UNAVAILABLE_MESSAGE,
					}),
				}),
			},
		),
	unexpected: {
		ok: false,
		message: "操作に失敗しました",
	} satisfies Extract<EndPeriodResponse, { ok: false }>,
	authenticationRequired: {
		ok: false,
		message: "ログインしてください",
	} satisfies Extract<EndPeriodResponse, { ok: false }>,
};

const MALFORMED_STORED_DATA_MESSAGE = "契約情報を読み込めませんでした";
const STORE_UNAVAILABLE_MESSAGE = "時間をおいてもう一度お試しください";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type EndTrialResponse = { ok: true } | { ok: false; message: string };

export type EndPeriodResponse = { ok: true } | { ok: false; message: string };
