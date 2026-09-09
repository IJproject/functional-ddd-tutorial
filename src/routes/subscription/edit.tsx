import { createFileRoute } from "@tanstack/react-router";
import { EditPage } from "#/pages/subscription/edit/edit";

export const Route = createFileRoute("/subscription/edit")({
	component: EditPage,
});
