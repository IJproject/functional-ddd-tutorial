import { Link } from "@tanstack/react-router";
import ThemeToggle from "#/components/theme/theme-toggle";

export default function Header() {
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

				<div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-none sm:w-auto sm:flex-nowrap sm:pb-0">
					<Link
						to="/"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						Home
					</Link>
					<Link
						to="/subscription/apply"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						申し込み
					</Link>
					<Link
						to="/subscription/edit"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						契約
					</Link>
					<Link
						to="/auth/login"
						className="nav-link"
						activeProps={{ className: "nav-link is-active" }}
					>
						ログイン
					</Link>
				</div>

				<div className="ml-auto flex items-center gap-1.5 sm:gap-2">
					<ThemeToggle />
				</div>
			</nav>
		</header>
	);
}
