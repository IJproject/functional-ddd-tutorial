import { err, ok, type Primitive, type Result } from "#/domain/building-blocks";

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
