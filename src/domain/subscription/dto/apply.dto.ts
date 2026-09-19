import * as z from "zod";
import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	Applied,
	ApplyError,
	UnvalidatedApplyRequest,
} from "#/domain/subscription/model/apply.model";
import type { StoreError } from "#/domain/subscription/model/store.model";

// ===========================================================================
// 型定義（デシリアライズ: JSON → DTO）
// ===========================================================================

/** 境界（JSON）での parse。プランとして妥当かはドメインの仕事。 */
export const applyCommandSchema = z.object({ planId: z.string() });

export type ApplyCommand = z.infer<typeof applyCommandSchema>;

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type ApplyFieldError = { field: "planId" | null; message: string };

export type ApplyResponse =
	| { ok: true }
	| { ok: false; errors: ApplyFieldError[] };

// ===========================================================================
// decode（DTO → ドメイン）
// ===========================================================================

/** ApplyCommand と認証済みアカウント ID → ドメインの未検証入力。 */
export const decodeApplyCommand = (
	command: ApplyCommand,
	accountId: string,
): UnvalidatedApplyRequest => ({
	accountId,
	planId: command.planId,
});

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** ドメインの結果 → ApplyResponse。 */
export const encodeApplyResponse = (
	result: ResultType<Applied, ApplyError | StoreError>,
): ApplyResponse =>
	Result.match<Applied, ApplyError | StoreError, ApplyResponse>(result, {
		ok: () => ({ ok: true }),
		err: (error) => ({ ok: false, errors: [toFieldError(error)] }),
	});

/** ワークフロー外の失敗（通信断・想定外の例外）。 */
export const UNEXPECTED_APPLY_RESPONSE: Extract<ApplyResponse, { ok: false }> =
	{
		ok: false,
		errors: [{ field: null, message: "申し込みに失敗しました" }],
	};

/** 認証済みセッションが必要な操作へ匿名で到達した。 */
export const AUTHENTICATION_REQUIRED_APPLY_RESPONSE: Extract<
	ApplyResponse,
	{ ok: false }
> = {
	ok: false,
	errors: [{ field: null, message: "ログインしてください" }],
};

/** ドメインのエラーを、表示対象の項目と文言へ網羅的に翻訳する。 */
const toFieldError = (error: ApplyError | StoreError): ApplyFieldError =>
	matchChoice(error, {
		InvalidApplyRequest: ({ reason }) =>
			matchChoice(reason, {
				UnknownPlan: () => ({
					field: "planId" as const,
					message: UNKNOWN_PLAN_MESSAGE,
				}),
			}),
		AlreadySubscribed: () => ({
			field: null,
			message: ALREADY_SUBSCRIBED_MESSAGE,
		}),
		MalformedSubscription: () => ({
			field: null,
			message: MALFORMED_STORED_DATA_MESSAGE,
		}),
		MalformedInvoice: () => ({
			field: null,
			message: MALFORMED_STORED_DATA_MESSAGE,
		}),
	});

const ALREADY_SUBSCRIBED_MESSAGE = "すでに契約中です";
const UNKNOWN_PLAN_MESSAGE = "有料プランを選択してください";
const MALFORMED_STORED_DATA_MESSAGE = "契約情報を読み込めませんでした";
