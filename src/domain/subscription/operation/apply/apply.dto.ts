import * as z from "zod";
import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { StoreError } from "#/domain/subscription/model/store.model";
import type {
	Applied,
	ApplyError,
	UnvalidatedApplyCommand,
} from "#/domain/subscription/operation/apply/apply.model";

// ===========================================================================
// 型定義（デシリアライズ: JSON → DTO）
// ===========================================================================

/** 境界（JSON）での parse。プランとして妥当かはドメインの仕事。 */
const applyRequestSchema = z.object({ planId: z.string() });

export type ApplyRequest = z.infer<typeof applyRequestSchema>;

// ===========================================================================
// decode（DTO → ドメイン）
// ===========================================================================

/** ApplyRequest と認証済みアカウント ID → ドメインの未検証入力。 */
export const ApplyRequest = {
	schema: applyRequestSchema,
	decode: (
		request: ApplyRequest,
		accountId: string,
	): UnvalidatedApplyCommand => ({
		accountId,
		planId: request.planId,
	}),
};

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** ドメインの結果 → ApplyResponse。 */
export const ApplyResponse = {
	encode: (
		result: ResultType<Applied, ApplyError | StoreError>,
	): ApplyResponse =>
		Result.match<Applied, ApplyError | StoreError, ApplyResponse>(result, {
			ok: () => ({ ok: true }),
			err: (error) => ({ ok: false, errors: [toFieldError(error)] }),
		}),
	/** ワークフロー外の失敗（通信断・想定外の例外）。 */
	unexpected: {
		ok: false,
		errors: [{ field: null, message: "申し込みに失敗しました" }],
	} satisfies Extract<ApplyResponse, { ok: false }>,
	/** 認証済みセッションが必要な操作へ匿名で到達した。 */
	authenticationRequired: {
		ok: false,
		errors: [{ field: null, message: "ログインしてください" }],
	} satisfies Extract<ApplyResponse, { ok: false }>,
};

/** ドメインのエラーを、表示対象の項目と文言へ網羅的に翻訳する。 */
const toFieldError = (error: ApplyError | StoreError): ApplyFieldError =>
	matchChoice(error, {
		InvalidApplyCommand: ({ reason }) =>
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

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type ApplyFieldError = { field: "planId" | null; message: string };

export type ApplyResponse =
	| { ok: true }
	| { ok: false; errors: ApplyFieldError[] };
