import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "#/components/control/button";
import { UserId } from "#/domain/auth/model/user.primitive";
import { Result } from "#/domain/building-blocks";
import {
	encodeSubscriptionSummaryView,
	SUBSCRIPTION_SUMMARY_UNAVAILABLE_MESSAGE,
} from "#/domain/subscription/dto/subscription-summary.dto";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { currentUser } from "#/external/better-auth/current-user";
import { loadSubscription } from "#/external/subscription-store/subscription-store";

type AuthenticatedHome = {
	loggedIn: true;
	name: string;
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
		err: (): AuthenticatedHome => {
			// 読み取りの View は失敗の形を持たないため reject させ、クライアントの catch が SUBSCRIPTION_SUMMARY_UNAVAILABLE_MESSAGE を表示する。
			// StoreError の reason は内部情報なので例外にも載せない。
			throw new Error();
		},
		ok: (subscription): AuthenticatedHome => {
			const summary = encodeSubscriptionSummaryView(subscription);
			return {
				loggedIn: true as const,
				name: user.name,
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
	const [notice, setNotice] = useState<string | null>(null);
	useEffect(() => {
		getHome()
			.then(setData)
			.catch(() => setNotice(SUBSCRIPTION_SUMMARY_UNAVAILABLE_MESSAGE));
	}, []);
	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">Subscription management</p>
				<h1 className="demo-title">サブスク管理をシンプルに。</h1>
				{notice !== null ? (
					<p className="demo-muted">{notice}</p>
				) : data?.loggedIn ? (
					<>
						<p className="m-0">{data.name}さん</p>
						<p className="demo-muted">
							現在: {data.planName ?? data.statusLabel}
							{data.planName ? `（${data.statusLabel}）` : null}
						</p>
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
