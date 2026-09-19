import * as z from "zod";
import {
	matchChoice,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	ChangePlanError,
	PlanChanged,
	UnvalidatedChangePlanRequest,
} from "#/domain/subscription/model/change-plan.model";
import type { StoreError } from "#/domain/subscription/model/store.model";

// ===========================================================================
// 型定義（デシリアライズ: JSON → DTO）
// ===========================================================================

/** 境界（JSON）での parse。プランとして妥当かはドメインの仕事。 */
export const changePlanCommandSchema = z.object({ planId: z.string() });
export type ChangePlanCommand = z.infer<typeof changePlanCommandSchema>;

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type ChangePlanFieldError = {
	field: "planId" | null;
	message: string;
};

export type ChangePlanResponse =
	| { ok: true }
	| { ok: false; errors: ChangePlanFieldError[] };

// ===========================================================================
// decode（DTO → ドメイン）
// ===========================================================================

/** ChangePlanCommand → ドメインの未検証入力。 */
export const decodeChangePlanCommand = (
	command: ChangePlanCommand,
): UnvalidatedChangePlanRequest => ({ planId: command.planId });

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** ドメインの結果 → ChangePlanResponse。 */
export const encodeChangePlanResponse = (
	result: ResultType<PlanChanged, ChangePlanError | StoreError>,
): ChangePlanResponse =>
	Result.match<PlanChanged, ChangePlanError | StoreError, ChangePlanResponse>(
		result,
		{
			ok: () => ({ ok: true }),
			err: (error) => ({ ok: false, errors: [toFieldError(error)] }),
		},
	);

export const UNEXPECTED_CHANGE_PLAN_RESPONSE: Extract<
	ChangePlanResponse,
	{ ok: false }
> = {
	ok: false,
	errors: [{ field: null, message: "操作に失敗しました" }],
};

export const AUTHENTICATION_REQUIRED_CHANGE_PLAN_RESPONSE: Extract<
	ChangePlanResponse,
	{ ok: false }
> = {
	ok: false,
	errors: [{ field: null, message: "ログインしてください" }],
};

const toFieldError = (
	error: ChangePlanError | StoreError,
): ChangePlanFieldError =>
	matchChoice<ChangePlanError | StoreError, ChangePlanFieldError>(error, {
		UnknownPlan: () => ({
			field: "planId",
			message: "有料プランを選択してください",
		}),
		NotSubscribed: () => ({
			field: null,
			message: "先にサブスクを申し込んでください",
		}),
		PlanChangeNotAllowed: () => ({
			field: null,
			message: "このプランには変更できません",
		}),
		PaymentPending: () => ({
			field: null,
			message: "支払い待ちの請求があります。先に支払ってください",
		}),
		ReservationExists: () => ({
			field: null,
			message: "すでに解約またはプラン変更の予約があります",
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

const MALFORMED_STORED_DATA_MESSAGE = "契約情報を読み込めませんでした";
