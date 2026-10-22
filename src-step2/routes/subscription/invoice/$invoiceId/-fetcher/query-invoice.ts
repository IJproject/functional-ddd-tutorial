import { type AsyncResult, err, ok } from "#/domain/building-blocks";
import type {
	FindInvoiceError,
	FindInvoicePort,
	Invoice,
	InvoiceId,
} from "#/domain/subscription/primitive";

/** 請求を表示できない理由。 */
export type QueryInvoiceError = "InvoiceNotFound" | FindInvoiceError;

/** queryInvoice が外から差し込んでもらうもの。 */
export type QueryInvoiceDeps = {
	findInvoice: FindInvoicePort;
};

/** 請求を1件読む。依存を受け取るので、テストでは偽物を渡せる。 */
export const queryInvoice =
	({ findInvoice }: QueryInvoiceDeps) =>
	async (invoiceId: InvoiceId): AsyncResult<Invoice, QueryInvoiceError> => {
		const invoice = await findInvoice(invoiceId);
		if (!invoice.ok) return invoice;
		if (invoice.value === null) return err("InvoiceNotFound");
		return ok(invoice.value);
	};
