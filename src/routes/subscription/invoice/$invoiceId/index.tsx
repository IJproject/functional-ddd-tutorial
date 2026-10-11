import { createFileRoute } from "@tanstack/react-router";
import { InvoicePage } from "./page";

export const Route = createFileRoute("/subscription/invoice/$invoiceId/")({
	component: InvoicePage,
});
