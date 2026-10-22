import {
	type AsyncResult,
	err,
	ok,
	type Primitive,
	type Result,
} from "#/domain/building-blocks";

/** 請求 ID。`INV-` + 数字8桁 + `-` + チェックディジット1桁（例: INV-12345678-6）。 */
export type InvoiceId = Primitive<"InvoiceId", string>;

/** 請求 ID として受け付けられない理由。 */
export type InvoiceIdError =
	| "InvoiceIdMalformed"
	| "InvoiceIdCheckDigitMismatch";

export const InvoiceId = {
	create: (input: string): Result<InvoiceId, InvoiceIdError> => {
		const matched = /^INV-(\d{8})-(\d)$/.exec(input);
		if (!matched) return err("InvoiceIdMalformed");
		const [, digits, checkDigit] = matched;
		// チェックディジットは、8桁の数字の和の下1桁。
		const sum = [...digits].reduce((total, digit) => total + Number(digit), 0);
		if (sum % 10 !== Number(checkDigit))
			return err("InvoiceIdCheckDigitMismatch");
		return ok(input as InvoiceId);
	},
	value: (invoiceId: InvoiceId): string => invoiceId,
};

/** 請求額（円）。0 以上の整数。 */
export type Amount = Primitive<"Amount", number>;

/** 請求額として受け付けられない理由。 */
export type AmountError = "AmountNotInteger" | "AmountNegative";

export const Amount = {
	create: (input: number): Result<Amount, AmountError> => {
		if (!Number.isInteger(input)) return err("AmountNotInteger");
		if (input < 0) return err("AmountNegative");
		return ok(input as Amount);
	},
	value: (amount: Amount): number => amount,
};

/** 請求を発行した日時。 */
export type IssuedAt = Primitive<"IssuedAt", Date>;

/** 発行日時として受け付けられない理由。 */
export type IssuedAtError = "IssuedAtInvalid";

export const IssuedAt = {
	/** ISO 8601 の文字列（例: 2026-10-11T13:00:00+09:00）を受け取る。 */
	create: (input: string): Result<IssuedAt, IssuedAtError> => {
		const date = new Date(input);
		if (Number.isNaN(date.getTime())) return err("IssuedAtInvalid");
		return ok(date as IssuedAt);
	},
	value: (issuedAt: IssuedAt): Date => issuedAt,
};

/** 請求。 */
export type Invoice = {
	id: InvoiceId;
	amount: Amount;
	issuedAt: IssuedAt;
};

/** 保存先から請求を読めなかった理由。 */
export type FindInvoiceError = "StoreUnavailable" | "StoredInvoiceMalformed";

/** 請求を ID で探すポート。見つからなければ null。 */
export type FindInvoicePort = (
	id: InvoiceId,
) => AsyncResult<Invoice | null, FindInvoiceError>;
