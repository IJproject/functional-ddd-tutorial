import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { StoreError } from "#/domain/subscription/model/store.model";
import type {
	CancellationReserved,
	CancelTrialError,
	ReserveCancellationError,
	TrialCancelled,
} from "#/domain/subscription/operation/cancel/cancel.model";

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** トライアル解約のドメイン結果 → CancelTrialResponse。 */
export const CancelTrialResponse = {
	encode: (
		result: ResultType<TrialCancelled, CancelTrialError | StoreError>,
	): CancelTrialResponse =>
		Result.match<
			TrialCancelled,
			CancelTrialError | StoreError,
			CancelTrialResponse
		>(result, {
			ok: () => ({ ok: true }),
			err: (error) => ({
				ok: false,
				message: matchChoice<CancelTrialError | StoreError, string>(error, {
					NotInTrial: () => "トライアル中ではありません",
					MalformedSubscription: () => MALFORMED_STORED_DATA_MESSAGE,
					MalformedInvoice: () => MALFORMED_STORED_DATA_MESSAGE,
					StoreUnavailable: () => STORE_UNAVAILABLE_MESSAGE,
				}),
			}),
		}),
	unexpected: {
		ok: false,
		message: "操作に失敗しました",
	} satisfies Extract<CancelTrialResponse, { ok: false }>,
	authenticationRequired: {
		ok: false,
		message: "ログインしてください",
	} satisfies Extract<CancelTrialResponse, { ok: false }>,
};

/** 解約予約のドメイン結果 → ReserveCancellationResponse。 */

export const ReserveCancellationResponse = {
	encode: (
		result: ResultType<
			CancellationReserved,
			ReserveCancellationError | StoreError
		>,
	): ReserveCancellationResponse =>
		Result.match<
			CancellationReserved,
			ReserveCancellationError | StoreError,
			ReserveCancellationResponse
		>(result, {
			ok: () => ({ ok: true }),
			err: (error) => ({
				ok: false,
				message: matchChoice<ReserveCancellationError | StoreError, string>(
					error,
					{
						NotPaid: () => "有料契約中ではありません",
						PaymentPending: () =>
							"支払い待ちの請求があります。先に支払ってください",
						MalformedSubscription: () => MALFORMED_STORED_DATA_MESSAGE,
						MalformedInvoice: () => MALFORMED_STORED_DATA_MESSAGE,
						StoreUnavailable: () => STORE_UNAVAILABLE_MESSAGE,
					},
				),
			}),
		}),
	unexpected: {
		ok: false,
		message: "操作に失敗しました",
	} satisfies Extract<ReserveCancellationResponse, { ok: false }>,
	authenticationRequired: {
		ok: false,
		message: "ログインしてください",
	} satisfies Extract<ReserveCancellationResponse, { ok: false }>,
};

const MALFORMED_STORED_DATA_MESSAGE = "契約情報を読み込めませんでした";
const STORE_UNAVAILABLE_MESSAGE = "時間をおいてもう一度お試しください";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type CancelTrialResponse = { ok: true } | { ok: false; message: string };

export type ReserveCancellationResponse =
	| { ok: true }
	| { ok: false; message: string };
