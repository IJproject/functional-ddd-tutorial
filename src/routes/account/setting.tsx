import { createFileRoute } from "@tanstack/react-router";
import { SettingPage } from "#/pages/account/setting/setting";

export const Route = createFileRoute("/account/setting")({
	component: SettingPage,
});
