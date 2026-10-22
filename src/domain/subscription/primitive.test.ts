import { describe, expect, it } from "vitest";
import { InvoiceId } from "./primitive";

/** @see {@link InvoiceId.create} */
describe("InvoiceId.create", () => {
	const TEST_CASES = [
		{
			title: "形式とチェックディジットが正しい ID を受け付ける",
			args: { input: "INV-12345678-6" },
			expected: { ok: true, value: "INV-12345678-6" },
		},
		{
			title: "数字の和が 0 のとき、チェックディジット 0 を受け付ける",
			args: { input: "INV-00000000-0" },
			expected: { ok: true, value: "INV-00000000-0" },
		},
		{
			title:
				"数字の和が2桁のとき、その下1桁をチェックディジットとして受け付ける",
			args: { input: "INV-99999999-2" },
			expected: { ok: true, value: "INV-99999999-2" },
		},
		{
			title: "チェックディジットが数字の和の下1桁と違うときは不一致になる",
			args: { input: "INV-12345678-2" },
			expected: { ok: false, error: "InvoiceIdCheckDigitMismatch" },
		},
		{
			title:
				"数字の和が 0 なのにチェックディジットが 0 でないときは不一致になる",
			args: { input: "INV-00000000-1" },
			expected: { ok: false, error: "InvoiceIdCheckDigitMismatch" },
		},
		{
			title: "INV- で始まらない文字列は形式違いになる",
			args: { input: "abc" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "空文字は形式違いになる",
			args: { input: "" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "接頭辞が小文字のときは形式違いになる",
			args: { input: "inv-12345678-6" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "数字が7桁のときは形式違いになる",
			args: { input: "INV-1234567-6" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "数字が9桁のときは形式違いになる",
			args: { input: "INV-123456789-6" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "数字の部分に数字以外が含まれるときは形式違いになる",
			args: { input: "INV-1234567a-6" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
		{
			title: "チェックディジットが2桁のときは形式違いになる",
			args: { input: "INV-12345678-66" },
			expected: { ok: false, error: "InvoiceIdMalformed" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(InvoiceId.create(args.input)).toEqual(expected);
	});
});
