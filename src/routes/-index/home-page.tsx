import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "#/components/control/button";
import { UserId } from "#/domain/auth/model/user.primitive";
import { Result } from "#/domain/building-blocks";
import {
	encodeSubscriptionSummary,
	STORE_UNAVAILABLE_MESSAGE,
} from "#/domain/subscription/dto/subscription-view.dto";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { currentUser } from "#/external/better-auth/current-user";
import { loadSubscription } from "#/external/subscription-store/subscription-store";

type AuthenticatedHome =
	| { loggedIn: true; name: string; subscriptionLoaded: false }
	| {
			loggedIn: true;
			name: string;
			subscriptionLoaded: true;
			statusLabel: string;
			planName: string | null;
	  };

const getHome = createServerFn({ method: "GET" }).handler(async () => {
	const user = await currentUser();
	if (!user) return { loggedIn: false as const };
	const loaded = await loadSubscription(
		AccountId.create(UserId.value(user.userId)),
	);
	return Result.match(loaded, {
		// 認証情報は読めているため、契約だけを隠してユーザー名は表示し続ける。
		err: (): AuthenticatedHome => ({
			loggedIn: true as const,
			name: user.name,
			subscriptionLoaded: false as const,
		}),
		ok: (subscription): AuthenticatedHome => {
			const summary = encodeSubscriptionSummary(subscription);
			return {
				loggedIn: true as const,
				name: user.name,
				subscriptionLoaded: true as const,
				statusLabel: summary.statusLabel,
				planName: summary.planName,
			};
		},
	});
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
						{data.subscriptionLoaded ? (
							<p className="demo-muted">
								現在: {data.planName ?? data.statusLabel}
								{data.planName ? `（${data.statusLabel}）` : null}
							</p>
						) : (
							<p className="demo-muted">{STORE_UNAVAILABLE_MESSAGE}</p>
						)}
						<Button kind="link" className="mt-4" to="/subscription/edit">
							契約を見る
						</Button>
					</>
				) : (
					<>
						<p className="demo-muted">
							サブスクリプションの申し込み、変更、請求をまとめて管理できます。
						</p>
						<div className="mt-6 flex flex-wrap gap-3">
							<Button kind="link" to="/auth/signup">
								アカウント登録
							</Button>
							<Button kind="link" to="/auth/login" variant="secondary">
								ログイン
							</Button>
						</div>
					</>
				)}
			</section>
		</main>
	);
}
