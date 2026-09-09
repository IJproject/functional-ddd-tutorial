import { createFileRoute } from "@tanstack/react-router";
import { ApplyPage } from "#/pages/subscription/apply/apply";

export const Route = createFileRoute("/subscription/apply")({
	component: ApplyPage,
});
