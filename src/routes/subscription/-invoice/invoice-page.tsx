import { getRouteApi } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type ReactNode, useEffect, useState } from "react";
import { invoiceDetail } from "#/application/subscription/invoice-detail";
import { Button } from "#/components/control/button";
import { Badge, type BadgeTone } from "#/components/data/badge";
import { Alert } from "#/components/feedback/alert";
import { matchChoice } from "#/domain/building-blocks";
import {
	INVOICE_DETAIL_UNAVAILABLE_MESSAGE,
	INVOICE_LOGIN_REQUIRED_MESSAGE,
	INVOICE_NOT_FOUND_DESCRIPTION,
	InvoiceDetailRequest,
	type InvoiceDetailView,
} from "#/domain/subscription/operation/invoice-detail/invoice-detail.dto";

/**
 * 動的セグメントはフラットルート側へ置き、ページ本体は既存の -<ページ>/<ページ>-page 規則に揃える。
 * ルートが InvoicePage を import するため、ここでは Route の直接 import による循環参照を避けて getRouteApi を使う。
 */
const routeApi = getRouteApi("/subscription/invoice/$invoiceId");

const INVOICE_DETAIL_TEXT = {
	title: "請求の詳細",
	loading: "読み込み中...",
	loginLink: "ログインへ",
	notFoundTitle: "請求が見つかりません",
	backToEdit: "契約へ戻る",
	invoiceIdLabel: "請求 ID",
	issuedAtLabel: "発行日時",
	purposeLabel: "請求理由",
	planLabel: "プラン",
} as const;

/**
 * 請求バッジの色。色は表示の都合なので DTO には持たせず、ここで決める。
 * キーは InvoiceDetailItemView.statusLabel の文言。
 * ホームにも同じ対応表があるが、衛星ファイルを跨いで import しない規約のため重複させている。
 */
const INVOICE_STATUS_TONE: Record<string, BadgeTone> = {
	未払い: "warning",
	支払い済み: "success",
	失敗: "danger",
};

const getInvoiceDetail = createServerFn({ method: "GET" })
	.validator(InvoiceDetailRequest.schema)
	.handler(async ({ data }) => invoiceDetail(data));

export function InvoicePage() {
	const { invoiceId } = routeApi.useParams();
	const [view, setView] = useState<InvoiceDetailView | null>(null);
	const [errors, setErrors] = useState<string[]>([]);

	useEffect(() => {
		setView(null);
		setErrors([]);
		getInvoiceDetail({ data: { invoiceId } })
			.then(setView)
			.catch(() => setErrors([INVOICE_DETAIL_UNAVAILABLE_MESSAGE]));
	}, [invoiceId]);

	const errorAlert = <Alert messages={errors} />;
	if (!view)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					{errors.length > 0 ? (
						errorAlert
					) : (
						<p className="demo-note">{INVOICE_DETAIL_TEXT.loading}</p>
					)}
				</section>
			</main>
		);

	const content = matchChoice<InvoiceDetailView, ReactNode>(view, {
		AnonymousInvoiceDetail: () => (
			<div className="space-y-4">
				<p className="demo-note">{INVOICE_LOGIN_REQUIRED_MESSAGE}</p>
				<Button kind="link" to="/auth/login">
					{INVOICE_DETAIL_TEXT.loginLink}
				</Button>
			</div>
		),
		InvoiceNotFound: () => (
			<div className="space-y-4">
				<h2 className="demo-section-title">
					{INVOICE_DETAIL_TEXT.notFoundTitle}
				</h2>
				<p className="demo-note">{INVOICE_NOT_FOUND_DESCRIPTION}</p>
				<Button kind="link" variant="secondary" to="/">
					{INVOICE_DETAIL_TEXT.backToEdit}
				</Button>
			</div>
		),
		InvoiceDetailUnavailable: () => (
			<Alert messages={[INVOICE_DETAIL_UNAVAILABLE_MESSAGE]} />
		),
		InvoiceFound: ({ invoice }) => (
			<div className="space-y-6">
				<article className="demo-card space-y-6">
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<p className="demo-metric-sm">
								¥{invoice.amount.toLocaleString()}
							</p>
							<Badge
								tone={INVOICE_STATUS_TONE[invoice.statusLabel] ?? "neutral"}
							>
								{invoice.statusLabel}
							</Badge>
						</div>
						<p className="demo-note">{invoice.statusDescription}</p>
					</div>
					<div className="flex flex-wrap gap-x-10 gap-y-4">
						<div className="space-y-1">
							<p className="demo-label">{INVOICE_DETAIL_TEXT.purposeLabel}</p>
							<p className="demo-value">{invoice.purposeLabel}</p>
						</div>
						<div className="space-y-1">
							<p className="demo-label">{INVOICE_DETAIL_TEXT.planLabel}</p>
							<p className="demo-value">{invoice.planName}</p>
						</div>
						<div className="space-y-1">
							<p className="demo-label">{INVOICE_DETAIL_TEXT.issuedAtLabel}</p>
							<p className="demo-value">{invoice.issuedAt}</p>
						</div>
						<div className="space-y-1">
							<p className="demo-label">{INVOICE_DETAIL_TEXT.invoiceIdLabel}</p>
							<p className="demo-value">{invoice.id}</p>
						</div>
					</div>
				</article>
				<Button kind="link" variant="secondary" to="/">
					{INVOICE_DETAIL_TEXT.backToEdit}
				</Button>
			</div>
		),
	});

	return (
		<main className="demo-page">
			<section className="demo-panel space-y-6">
				<h1 className="demo-title">{INVOICE_DETAIL_TEXT.title}</h1>
				{errorAlert}
				{content}
			</section>
		</main>
	);
}
