import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ok, type Result } from "#/domain/building-blocks";
import {
	InvoiceId,
	type InvoiceIdError,
} from "#/domain/subscription/primitive";
import { findInvoiceAdapter } from "#/external/db/find-invoice";
import { queryInvoice } from "./-fetcher/query-invoice";
import { InvoicePage } from "./page";

export const Route = createFileRoute("/subscription/invoice/$invoiceId/")({
	params: { parse: parseInvoiceParams },
	loader: ({ params }) => fetchInvoice({ data: params }),
	component: RouteComponent,
});

function RouteComponent() {
	const invoice = Route.useLoaderData();
	if (!invoice.ok) throw new Error(invoice.error);
	return <InvoicePage invoice={invoice.value} />;
}

/** サーバーで請求を読む。queryInvoice に DB のアダプターを差し込む（composition root）。 */
const fetchInvoice = createServerFn({ method: "GET" })
	.validator(parseInvoiceParams)
	.handler(({ data }) =>
		queryInvoice({ findInvoice: findInvoiceAdapter })(data.invoiceId),
	);

/** URLパラメータのparserとDTO */
function parseInvoiceParams(params: InvoiceParamsDto) {
	const parsed = InvoiceParamsDto.toDomain(params);
	if (!parsed.ok) throw new Error(parsed.error);
	return parsed.value;
}
type InvoiceParamsDto = { invoiceId: string };
const InvoiceParamsDto = {
	toDomain: (
		dto: InvoiceParamsDto,
	): Result<{ invoiceId: InvoiceId }, InvoiceIdError> => {
		const invoiceId = InvoiceId.create(dto.invoiceId);
		if (!invoiceId.ok) return invoiceId;
		return ok({ invoiceId: invoiceId.value });
	},
};
