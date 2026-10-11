import { type Case, matchChoice } from "#/domain/building-blocks";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import {
	Amount,
	type InvoiceId,
	type IssuedAt,
	type PaidAt,
} from "#/domain/subscription/model/invoice.primitive";
import {
	Plan,
	type PlanUpgrade,
	upgradeDifference,
} from "#/domain/subscription/model/plan.entity";
import type { PlanId } from "#/domain/subscription/model/plan.model";
import { MonthlyPrice } from "#/domain/subscription/model/plan.primitive";

// ===========================================================================
// 型定義
// ===========================================================================

/**
 * 請求が立った理由と対象プラン。支払いの状態とは別の軸なので purpose に持たせる。
 * seed でもリテラルで対象を明示するため、定数オブジェクトは置かない。
 * 変更元と変更先は PlanUpgrade が持つので、ダウングレードの組は表せない。
 */
export type InvoicePurpose =
	| Case<"New", { planId: PlanId }>
	| Case<"Renewal", { planId: PlanId }>
	| Case<"UpgradeDifference", { upgrade: PlanUpgrade }>;

export type Invoice = UnpaidInvoice | PaidInvoice | FailedInvoice;

export type UnpaidInvoice = Case<"UnpaidInvoice", InvoiceFields>;
/** 支払いが成立した請求だけが支払日を持つ。 */
export type PaidInvoice = Case<
	"PaidInvoice",
	InvoiceFields & { paidAt: PaidAt }
>;
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
		UpgradeDifference: ({ upgrade }) => upgrade.to,
	});

/**
 * 発行する請求の金額。料金表から決まるので、ワークフローは金額を書かない。
 * 復元では呼ばない。保存された額は発行時点の事実であり、現行料金と照合すると
 * 料金改定で過去の請求が読めなくなるため。
 */
const issuedAmount = (purpose: InvoicePurpose): Amount =>
	matchChoice<InvoicePurpose, Amount>(purpose, {
		New: ({ planId }) =>
			Amount.create(MonthlyPrice.value(Plan.of(planId).monthlyPrice)),
		Renewal: ({ planId }) =>
			Amount.create(MonthlyPrice.value(Plan.of(planId).monthlyPrice)),
		UpgradeDifference: ({ upgrade }) => upgradeDifference(upgrade),
	});

export const Invoice = {
	/**
	 * 請求を発行する。金額は料金表から決まるので、呼び出し側は金額を渡さない。
	 * 復元（StoredInvoice.decode）では使わない。保存された額は発行時点の事実であるため。
	 */
	issue: (fields: {
		id: InvoiceId;
		accountId: AccountId;
		purpose: InvoicePurpose;
		issuedAt: IssuedAt;
	}): UnpaidInvoice => ({
		kind: "UnpaidInvoice",
		...fields,
		amount: issuedAmount(fields.purpose),
	}),
};
