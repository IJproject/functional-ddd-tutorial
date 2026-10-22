import { describe, expect, it } from "vitest";
import { Amount, InvoiceId, IssuedAt } from "./primitive";

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

/** @see {@link Amount.create} */
describe("Amount.create", () => {
	const TEST_CASES = [
		{
			title: "正の整数を受け付ける",
			args: { input: 1980 },
			expected: { ok: true, value: 1980 },
		},
		{
			title: "0 を受け付ける",
			args: { input: 0 },
			expected: { ok: true, value: 0 },
		},
		{
			title: "負の数は受け付けない",
			args: { input: -1 },
			expected: { ok: false, error: "AmountNegative" },
		},
		{
			title: "小数は受け付けない",
			args: { input: 1.5 },
			expected: { ok: false, error: "AmountNotInteger" },
		},
		{
			title: "NaN は受け付けない",
			args: { input: Number.NaN },
			expected: { ok: false, error: "AmountNotInteger" },
		},
		{
			title: "Infinity は受け付けない",
			args: { input: Number.POSITIVE_INFINITY },
			expected: { ok: false, error: "AmountNotInteger" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(Amount.create(args.input)).toEqual(expected);
	});
});

/** @see {@link IssuedAt.create} */
describe("IssuedAt.create", () => {
	const TEST_CASES = [
		{
			title: "時差付きの ISO 8601 を受け付ける",
			args: { input: "2026-10-11T13:00:00+09:00" },
			expected: { ok: true, value: new Date("2026-10-11T04:00:00Z") },
		},
		{
			title: "UTC の ISO 8601 を受け付ける",
			args: { input: "2026-10-11T04:00:00Z" },
			expected: { ok: true, value: new Date("2026-10-11T04:00:00Z") },
		},
		{
			title: "日付として読めない文字列は受け付けない",
			args: { input: "abc" },
			expected: { ok: false, error: "IssuedAtInvalid" },
		},
		{
			title: "空文字は受け付けない",
			args: { input: "" },
			expected: { ok: false, error: "IssuedAtInvalid" },
		},
		{
			title: "存在しない月は受け付けない",
			args: { input: "2026-13-01T00:00:00Z" },
			expected: { ok: false, error: "IssuedAtInvalid" },
		},
	];

	it.each(TEST_CASES)("$title", ({ args, expected }) => {
		expect(IssuedAt.create(args.input)).toEqual(expected);
	});
});
