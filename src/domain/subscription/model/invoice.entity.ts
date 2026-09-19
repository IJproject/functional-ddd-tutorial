import {
	type Case,
	err,
	matchChoice,
	ok,
	Result,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type { AccountId } from "#/domain/subscription/model/account.primitive";
import {
	Amount,
	type InvoiceId,
	type IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Plan } from "#/domain/subscription/model/plan.entity";
import type { PlanId } from "#/domain/subscription/model/plan.primitive";
import { MonthlyPrice } from "#/domain/subscription/model/plan.primitive";

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

export const InvoicePurpose = {
	/** 新規契約に対する請求。 */
	New: { kind: "New" },
	/** 契約更新に対する請求。 */
	Renewal: { kind: "Renewal" },
	/** アップグレード時の差額請求。 */
	UpgradeDifference: { kind: "UpgradeDifference" },
} as const satisfies Record<InvoicePurpose["kind"], InvoicePurpose>;

export type Invoice = UnpaidInvoice | PaidInvoice | FailedInvoice;

/** 請求の構築が失敗する理由。文言は持たない。 */
export type InvoiceError = Case<
	"AmountMismatch",
	{ expected: number; actual: number }
>;

export type UnpaidInvoice = Case<"UnpaidInvoice", InvoiceFields>;
export type PaidInvoice = Case<"PaidInvoice", InvoiceFields>;
export type FailedInvoice = Case<"FailedInvoice", InvoiceFields>;

/** 3つの Case に共通するフィールドを1箇所に書くための型。 */
export type InvoiceFields = {
	id: InvoiceId;
	accountId: AccountId;
	planId: PlanId;
	amount: Amount;
	purpose: InvoicePurpose;
	issuedAt: IssuedAt;
};

// New と Renewal の請求額を、変更されない料金表である Plan と照合する。
const validateAmount = (
	fields: InvoiceFields,
): ResultType<InvoiceFields, InvoiceError> =>
	matchChoice<InvoicePurpose, ResultType<InvoiceFields, InvoiceError>>(
		fields.purpose,
		{
			New: () => validateMonthlyPrice(fields),
			Renewal: () => validateMonthlyPrice(fields),
			UpgradeDifference: () => {
				// Invoice は変更前プランを持たず、差額が正しいか判定できないため検証しない。
				return ok(fields);
			},
		},
	);

const validateMonthlyPrice = (
	fields: InvoiceFields,
): ResultType<InvoiceFields, InvoiceError> => {
	const expected = MonthlyPrice.value(Plan.of(fields.planId).monthlyPrice);
	const actual = Amount.value(fields.amount);
	return actual === expected
		? ok(fields)
		: err({ kind: "AmountMismatch", expected, actual });
};

export const Invoice = {
	/** 支払いを待っている請求を構築する。 */
	unpaid: (fields: InvoiceFields): ResultType<UnpaidInvoice, InvoiceError> =>
		Result.match<
			InvoiceFields,
			InvoiceError,
			ResultType<UnpaidInvoice, InvoiceError>
		>(validateAmount(fields), {
			ok: (validFields) => ok({ kind: "UnpaidInvoice", ...validFields }),
			err,
		}),

	/** 支払いに成功した請求を構築する。 */
	paid: (fields: InvoiceFields): ResultType<PaidInvoice, InvoiceError> =>
		Result.match<
			InvoiceFields,
			InvoiceError,
			ResultType<PaidInvoice, InvoiceError>
		>(validateAmount(fields), {
			ok: (validFields) => ok({ kind: "PaidInvoice", ...validFields }),
			err,
		}),

	/** 支払いに失敗した請求を構築する。 */
	failed: (fields: InvoiceFields): ResultType<FailedInvoice, InvoiceError> =>
		Result.match<
			InvoiceFields,
			InvoiceError,
			ResultType<FailedInvoice, InvoiceError>
		>(validateAmount(fields), {
			ok: (validFields) => ok({ kind: "FailedInvoice", ...validFields }),
			err,
		}),
};
