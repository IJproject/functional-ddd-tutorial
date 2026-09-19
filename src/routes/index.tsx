import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchHomeSession, HomePage } from "./-index/home-page";

export const Route = createFileRoute("/")({
	// `/` はログイン後のダッシュボード。未ログインの入口は /auth/login に一本化する。
	beforeLoad: async () => {
		const { loggedIn } = await fetchHomeSession();
		if (!loggedIn) throw redirect({ to: "/auth/login" });
	},
	component: HomePage,
});
