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

// ===========================================================================
// 型定義
// ===========================================================================

/** 境界（JSON）での parse。プランとして妥当かはドメインの仕事。 */
export const changePlanCommandSchema = z.object({ planId: z.string() });
export type ChangePlanCommand = z.infer<typeof changePlanCommandSchema>;

export type ChangePlanFieldError = {
	field: "planId" | null;
	message: string;
};

export type ChangePlanResponse =
	| { ok: true }
	| { ok: false; errors: ChangePlanFieldError[] };

// ===========================================================================
// 実装
// ===========================================================================

const toFieldError = (error: ChangePlanError): ChangePlanFieldError =>
	matchChoice<ChangePlanError, ChangePlanFieldError>(error, {
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
	});

/** ChangePlanCommand → ドメインの未検証入力。 */
export const decodeChangePlanCommand = (
	command: ChangePlanCommand,
): UnvalidatedChangePlanRequest => ({ planId: command.planId });

/** ドメインの結果 → ChangePlanResponse。 */
export const encodeChangePlanResponse = (
	result: ResultType<PlanChanged, ChangePlanError>,
): ChangePlanResponse =>
	Result.match<PlanChanged, ChangePlanError, ChangePlanResponse>(result, {
		ok: () => ({ ok: true }),
		err: (error) => ({ ok: false, errors: [toFieldError(error)] }),
	});
