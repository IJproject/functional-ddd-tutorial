import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "#/pages/billing/list/list";

export const Route = createFileRoute("/billing/list")({
	component: BillingPage,
});
