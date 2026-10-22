import { createFileRoute } from "@tanstack/react-router";
import { ok, type Result } from "#/domain/building-blocks";
import {
	InvoiceId,
	type InvoiceIdError,
} from "#/domain/subscription/primitive";
import { InvoicePage } from "./page";

export const Route = createFileRoute("/subscription/invoice/$invoiceId/")({
	params: { parse: parseInvoiceParams },
	component: RouteComponent,
});

function RouteComponent() {
	const { invoiceId } = Route.useParams();
	return <InvoicePage invoiceId={invoiceId} />;
}

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
