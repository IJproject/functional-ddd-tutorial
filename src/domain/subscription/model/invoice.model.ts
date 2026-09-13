import type { Case } from "#/domain/building-blocks";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import type {
	Amount,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import type { PlanId } from "#/domain/subscription/model/plan.primitive";

// ===========================================================================
// 型定義
// ===========================================================================

/**
 * 請求が立った理由。金額の決まり方が違うので種類で区別する。
 *
 * `kind` ではなく `purpose` という名前にしているのは、Case の判別子が `kind` であり、
 * `Case<"UnpaidInvoice", { kind: InvoicePurpose }>` と書くと交差型で判別子が潰れるため。
 * 「支払いの状態」と「請求の理由」は別の軸なので、名前でも分けている。
 */
export type InvoicePurpose =
	| Case<"New">
	| Case<"Renewal">
	| Case<"UpgradeDifference">;

export type Invoice = UnpaidInvoice | PaidInvoice | FailedInvoice;

export type UnpaidInvoice = Case<"UnpaidInvoice", InvoiceFields>;
export type PaidInvoice = Case<"PaidInvoice", InvoiceFields>;
export type FailedInvoice = Case<"FailedInvoice", InvoiceFields>;

/** 3つの Case に共通するフィールドを1箇所に書くための内部型。 */
type InvoiceFields = {
	id: InvoiceId;
	accountId: AccountId;
	planId: PlanId;
	amount: Amount;
	purpose: InvoicePurpose;
	issuedAt: IssuedAt;
};
