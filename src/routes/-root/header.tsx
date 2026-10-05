import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { logout as logoutAction } from "#/application/auth/logout";
import { sessionViewOrAnonymous } from "#/application/auth/session-view";
import { Button } from "#/components/control/button";
import ThemeToggle from "#/components/theme/theme-toggle";
import type { SessionView } from "#/domain/auth/operation/session-view/session-view.dto";

export const fetchHeaderSession = createServerFn({ method: "GET" }).handler(
	sessionViewOrAnonymous,
);

const logout = createServerFn({ method: "POST" }).handler(logoutAction);

export default function Header({ session }: { session: SessionView }) {
	const router = useRouter();
	const navigate = useNavigate();

	async function signout() {
		try {
			await logout();
		} catch {
			// 破棄できたか不明でも、再取得して実態に合わせる。
		}
		await router.invalidate();
		// `/` は未ログインなら /auth/login へ飛ぶので、二段遷移を避けて直接送る。
		await navigate({ to: "/auth/login" });
	}

	return (
		<header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-sm">
			<nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
				<h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text)] no-underline"
					>
						<span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
						Subsc Tutorial
					</Link>
				</h2>

				{session.loggedIn && (
					<div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-none sm:w-auto sm:flex-nowrap sm:pb-0">
						<Link
							to="/subscription/apply"
							className="nav-link"
							activeProps={{ className: "nav-link is-active" }}
						>
							申し込み
						</Link>
					</div>
				)}

				<div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
					{session.loggedIn ? (
						<Button kind="action" variant="secondary" onClick={signout}>
							ログアウト
						</Button>
					) : (
						<>
							<Button kind="link" to="/auth/login" variant="secondary">
								ログイン
							</Button>
							<Button kind="link" to="/auth/signup">
								新規登録
							</Button>
						</>
					)}
					<ThemeToggle />
				</div>
			</nav>
		</header>
	);
}
