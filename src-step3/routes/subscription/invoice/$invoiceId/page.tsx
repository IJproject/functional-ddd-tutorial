import type { Invoice } from "#/domain/subscription/primitive";
import { formatDateTime } from "#/helpers/date";

// エラーハンドリングの処理を書かないと、Resultで返ってきた値の中身にアクセスできないようになっている
export function InvoicePage({ invoice }: { invoice: Invoice }) {
	return (
		<section className="demo-panel space-y-6">
			<h1 className="demo-title">請求の詳細</h1>
			<div className="space-y-6">
				<article className="demo-card space-y-6">
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<p className="demo-metric-sm">
								¥{invoice.amount.toLocaleString("ja-JP")}
							</p>
							<span className="demo-badge-warning">未払い</span>
						</div>
						<p className="demo-note">お支払いをお待ちしています。</p>
					</div>
					<div className="flex flex-wrap gap-x-10 gap-y-4">
						<div className="space-y-1">
							<p className="demo-label">請求理由</p>
							<p className="demo-value">新規申し込み</p>
						</div>
						<div className="space-y-1">
							<p className="demo-label">プラン</p>
							<p className="demo-value">スタンダード</p>
						</div>
						<div className="space-y-1">
							<p className="demo-label">発行日時</p>
							<p className="demo-value">{formatDateTime(invoice.issuedAt)}</p>
						</div>
						<div className="space-y-1">
							<p className="demo-label">請求 ID</p>
							<p className="demo-value">{invoice.id}</p>
						</div>
					</div>
				</article>
				<a className="demo-button-secondary" href="/">
					契約へ戻る
				</a>
			</div>
		</section>
	);
}
