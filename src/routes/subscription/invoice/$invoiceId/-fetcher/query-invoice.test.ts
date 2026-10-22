import { describe, expect, it } from "vitest";
import type { FindInvoicePort, Invoice } from "#/domain/subscription/primitive";
import { queryInvoice } from "./query-invoice";

const INVOICE = {
	id: "INV-12345678-6",
	amount: 1980,
	issuedAt: new Date("2026-10-11T04:00:00Z"),
} as Invoice;

// findInvoiceAdapter の代わりに差し込む偽物。保存先の答え方ごとに1つずつ用意する
const findInvoiceStubAdapter = {
	found: async () => ({ ok: true, value: INVOICE }),
	notFound: async () => ({ ok: true, value: null }),
	unavailable: async () => ({ ok: false, error: "StoreUnavailable" }),
	malformed: async () => ({ ok: false, error: "StoredInvoiceMalformed" }),
} satisfies Record<string, FindInvoicePort>;

/** @see {@link queryInvoice} */
describe("queryInvoice", () => {
	const TEST_CASES = [
		{
			title: "請求が見つかれば、その請求を返す",
			args: { findInvoice: findInvoiceStubAdapter.found },
			expected: { ok: true, value: INVOICE },
		},
		{
			title: "請求が無ければ InvoiceNotFound になる",
			args: { findInvoice: findInvoiceStubAdapter.notFound },
			expected: { ok: false, error: "InvoiceNotFound" },
		},
		{
			title: "保存先に届かなければ StoreUnavailable になる",
			args: { findInvoice: findInvoiceStubAdapter.unavailable },
			expected: { ok: false, error: "StoreUnavailable" },
		},
		{
			title: "保存されている行が壊れていれば StoredInvoiceMalformed になる",
			args: { findInvoice: findInvoiceStubAdapter.malformed },
			expected: { ok: false, error: "StoredInvoiceMalformed" },
		},
	];

	it.each(TEST_CASES)("$title", async ({ args, expected }) => {
		const result = await queryInvoice({ findInvoice: args.findInvoice })(
			INVOICE.id,
		);
		expect(result).toEqual(expected);
	});
});
