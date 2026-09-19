import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	CancellationReserved,
	CancelTrialError,
	ReserveCancellationError,
	TrialCancelled,
} from "#/domain/subscription/model/cancel.model";
import type { StoreError } from "#/domain/subscription/model/store.model";

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type CancelResponse = { ok: true } | { ok: false; message: string };

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** トライアル解約のドメイン結果 → CancelResponse。 */
export const encodeCancelTrialResponse = (
	result: ResultType<TrialCancelled, CancelTrialError | StoreError>,
): CancelResponse =>
	Result.match<TrialCancelled, CancelTrialError | StoreError, CancelResponse>(
		result,
		{
			ok: () => ({ ok: true }),
			err: (error) => ({
				ok: false,
				message: matchChoice<CancelTrialError | StoreError, string>(error, {
					NotInTrial: () => "トライアル中ではありません",
					MalformedSubscription: () => MALFORMED_STORED_DATA_MESSAGE,
					MalformedInvoice: () => MALFORMED_STORED_DATA_MESSAGE,
				}),
			}),
		},
	);

/** 解約予約のドメイン結果 → CancelResponse。 */
export const encodeReserveCancellationResponse = (
	result: ResultType<
		CancellationReserved,
		ReserveCancellationError | StoreError
	>,
): CancelResponse =>
	Result.match<
		CancellationReserved,
		ReserveCancellationError | StoreError,
		CancelResponse
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
				},
			),
		}),
	});

export const UNEXPECTED_CANCEL_RESPONSE: Extract<
	CancelResponse,
	{ ok: false }
> = {
	ok: false,
	message: "操作に失敗しました",
};

export const AUTHENTICATION_REQUIRED_CANCEL_RESPONSE: Extract<
	CancelResponse,
	{ ok: false }
> = {
	ok: false,
	message: "ログインしてください",
};

const MALFORMED_STORED_DATA_MESSAGE = "契約情報を読み込めませんでした";
