import { createFileRoute } from "@tanstack/react-router";
import { InvoicePage } from "./-invoice/invoice-page";

export const Route = createFileRoute("/subscription/invoice/$invoiceId")({
	component: InvoicePage,
});
