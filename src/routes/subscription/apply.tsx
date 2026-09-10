import { createFileRoute } from "@tanstack/react-router";
import { ApplyPage } from "./-apply/apply-page";

export const Route = createFileRoute("/subscription/apply")({
	component: ApplyPage,
});
