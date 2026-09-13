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

// ===========================================================================
// 型定義
// ===========================================================================

export type CancelResponse = { ok: true } | { ok: false; message: string };

// ===========================================================================
// 実装
// ===========================================================================

/** トライアル解約のドメイン結果 → CancelResponse。 */
export const encodeCancelTrialResponse = (
	result: ResultType<TrialCancelled, CancelTrialError>,
): CancelResponse =>
	Result.match<TrialCancelled, CancelTrialError, CancelResponse>(result, {
		ok: () => ({ ok: true }),
		err: (error) => ({
			ok: false,
			message: matchChoice<CancelTrialError, string>(error, {
				NotInTrial: () => "トライアル中ではありません",
			}),
		}),
	});

/** 解約予約のドメイン結果 → CancelResponse。 */
export const encodeReserveCancellationResponse = (
	result: ResultType<CancellationReserved, ReserveCancellationError>,
): CancelResponse =>
	Result.match<CancellationReserved, ReserveCancellationError, CancelResponse>(
		result,
		{
			ok: () => ({ ok: true }),
			err: (error) => ({
				ok: false,
				message: matchChoice<ReserveCancellationError, string>(error, {
					NotPaid: () => "有料契約中ではありません",
					PaymentPending: () =>
						"支払い待ちの請求があります。先に支払ってください",
				}),
			}),
		},
	);
