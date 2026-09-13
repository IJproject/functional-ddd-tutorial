import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { UserId } from "#/domain/auth/model/user.primitive";
import { encodeSubscriptionSummary } from "#/domain/subscription/dto/subscription-view.dto";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { currentUser } from "#/external/better-auth/current-user";
import { loadSubscription } from "#/external/subscription-store/subscription-store";

const getHome = createServerFn({ method: "GET" }).handler(async () => {
	const user = await currentUser();
	if (!user) return { loggedIn: false as const };
	const summary = encodeSubscriptionSummary(
		loadSubscription(AccountId.create(UserId.value(user.userId))),
	);
	return {
		loggedIn: true as const,
		name: user.name,
		statusLabel: summary.statusLabel,
		planName: summary.planName,
	};
});

export function HomePage() {
	const [data, setData] = useState<Awaited<ReturnType<typeof getHome>> | null>(
		null,
	);
	useEffect(() => {
		getHome()
			.then(setData)
			.catch(() => setData({ loggedIn: false }));
	}, []);
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">Subscription management</p>
				<h1 className="demo-title">サブスク管理をシンプルに。</h1>
				{data?.loggedIn ? (
					<>
						<p className="m-0">{data.name}さん</p>
						<p className="demo-muted">
							現在: {data.planName ?? data.statusLabel}
							{data.planName ? `（${data.statusLabel}）` : null}
						</p>
						<Link className="demo-button mt-4" to="/subscription/edit">
							契約を見る
						</Link>
					</>
				) : (
					<>
						<p className="demo-muted">
							サブスクリプションの申し込み、変更、請求をまとめて管理できます。
						</p>
						<div className="mt-6 flex flex-wrap gap-3">
							<Link className="demo-button" to="/auth/signup">
								アカウント登録
							</Link>
							<Link className="demo-button-secondary" to="/auth/login">
								ログイン
							</Link>
						</div>
					</>
				)}
			</section>
		</main>
	);
}
