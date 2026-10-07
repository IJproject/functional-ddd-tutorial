import { type Case, matchChoice } from "#/domain/building-blocks";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import {
	Amount,
	type InvoiceId,
	type IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Plan, type PlanChange } from "#/domain/subscription/model/plan.entity";
import type { PlanId } from "#/domain/subscription/model/plan.model";
import { MonthlyPrice } from "#/domain/subscription/model/plan.primitive";

// ===========================================================================
// 型定義
// ===========================================================================

/**
 * 請求が立った理由と対象プラン。支払いの状態とは別の軸なので purpose に持たせる。
 * seed でもリテラルで対象を明示するため、定数オブジェクトは置かない。
 */
export type InvoicePurpose =
	| Case<"New", { planId: PlanId }>
	| Case<"Renewal", { planId: PlanId }>
	| Case<"UpgradeDifference", { from: PlanId; to: PlanId }>;

export type Invoice = UnpaidInvoice | PaidInvoice | FailedInvoice;

export type UnpaidInvoice = Case<"UnpaidInvoice", InvoiceFields>;
export type PaidInvoice = Case<"PaidInvoice", InvoiceFields>;
export type FailedInvoice = Case<"FailedInvoice", InvoiceFields>;

/** 3つの Case に共通するフィールドを1箇所に書くための型。 */
export type InvoiceFields = {
	id: InvoiceId;
	accountId: AccountId;
	amount: Amount;
	purpose: InvoicePurpose;
	issuedAt: IssuedAt;
};

// ===========================================================================
// 実装
// ===========================================================================

/** この請求が対象とするプラン。UpgradeDifference では変更先を指す。 */
export const billedPlanId = (purpose: InvoicePurpose): PlanId =>
	matchChoice<InvoicePurpose, PlanId>(purpose, {
		New: ({ planId }) => planId,
		Renewal: ({ planId }) => planId,
		UpgradeDifference: ({ to }) => to,
	});

/**
 * 発行する請求の金額。料金表から決まるので、ワークフローは金額を書かない。
 * 復元では呼ばない。保存された額は発行時点の事実であり、現行料金と照合すると
 * 料金改定で過去の請求が読めなくなるため。
 */
export const issuedAmount = (purpose: InvoicePurpose): Amount =>
	matchChoice<InvoicePurpose, Amount>(purpose, {
		New: ({ planId }) =>
			Amount.create(MonthlyPrice.value(Plan.of(planId).monthlyPrice)),
		Renewal: ({ planId }) =>
			Amount.create(MonthlyPrice.value(Plan.of(planId).monthlyPrice)),
		UpgradeDifference: ({ from, to }) =>
			matchChoice<PlanChange, Amount>(Plan.change(from, to), {
				Upgrade: ({ difference }) => difference,
				Downgrade: () => {
					// UpgradeDifference を組み立てるのは change-plan の Upgrade 分岐だけなので、ここに来るのはプログラムの誤り。§3.3 のパニックに当たる。
					throw new Error("UpgradeDifference requires an upgrade");
				},
			}),
	});
