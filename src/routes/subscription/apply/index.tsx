import { createFileRoute } from "@tanstack/react-router";
import { ApplyPage } from "./page";

export const Route = createFileRoute("/subscription/apply/")({
	component: ApplyPage,
});
