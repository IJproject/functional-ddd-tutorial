import { eq } from "drizzle-orm";
import { err, ok, type Result } from "#/domain/building-blocks";
import {
	Amount,
	type FindInvoicePort,
	type Invoice,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/primitive";
import { db } from "#/external/db/client";
import { subscriptionInvoiceTable } from "#/external/db/schema";

export const findInvoiceAdapter: FindInvoicePort = async (id) => {
	const rows = await db
		.select()
		.from(subscriptionInvoiceTable)
		.where(eq(subscriptionInvoiceTable.invoiceId, id))
		.limit(1)
		.catch((error) => {
			console.error(error);
			return null;
		});
	if (rows === null) return err("StoreUnavailable");
	const [row] = rows;
	if (!row) return ok(null);
	return StoredInvoiceDto.toDomain(row);
};

/** DB に保存されている請求の行。 */
type StoredInvoiceDto = typeof subscriptionInvoiceTable.$inferSelect;
const StoredInvoiceDto = {
	toDomain: (
		dto: StoredInvoiceDto,
	): Result<Invoice, "StoredInvoiceMalformed"> => {
		const id = InvoiceId.create(dto.invoiceId);
		if (!id.ok) return err("StoredInvoiceMalformed");
		const amount = Amount.create(dto.amount);
		if (!amount.ok) return err("StoredInvoiceMalformed");
		const issuedAt = IssuedAt.create(dto.issuedAt.toISOString());
		if (!issuedAt.ok) return err("StoredInvoiceMalformed");
		return ok({ id: id.value, amount: amount.value, issuedAt: issuedAt.value });
	},
};
