import { createFileRoute } from "@tanstack/react-router";
import { EditPage } from "./-edit/edit-page";

export const Route = createFileRoute("/subscription/edit")({
	component: EditPage,
});
