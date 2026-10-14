import { createFileRoute } from "@tanstack/react-router";
import { ok, type Result } from "#/domain/building-blocks";
import {
	InvoiceId,
	type InvoiceIdError,
} from "#/domain/subscription/primitive";
import { InvoicePage } from "./page";

export const Route = createFileRoute("/subscription/invoice/$invoiceId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const params = InvoiceParamsDto.toDomain(Route.useParams());
	if (!params.ok) throw new Error(params.error);
	return <InvoicePage invoiceId={params.value.invoiceId} />;
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
