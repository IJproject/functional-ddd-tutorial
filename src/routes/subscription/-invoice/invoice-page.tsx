import { getRouteApi } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "#/components/control/button";
import { Badge, type BadgeTone } from "#/components/data/badge";
import { Alert } from "#/components/feedback/alert";
import { UserId } from "#/domain/auth/model/user.primitive";
import { matchChoice, Result } from "#/domain/building-blocks";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import {
	decodeInvoiceParams,
	encodeInvoiceDetailView,
	INVOICE_DETAIL_UNAVAILABLE_MESSAGE,
	INVOICE_LOGIN_REQUIRED_MESSAGE,
	INVOICE_NOT_FOUND_DESCRIPTION,
	type InvoiceDetailView,
	invoiceParamsSchema,
} from "#/domain/subscription/operation/invoice-detail/invoice-detail.dto";
import { currentSession } from "#/external/better-auth/current-session";
import { findInvoice } from "#/external/subscription-store/subscription-store";

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

/** auth BC の UserId を subscription BC の AccountId へ境界層で翻訳する。 */
const toAccountId = (userId: UserId): AccountId =>
	AccountId.create(UserId.value(userId));

const getInvoiceDetail = createServerFn({ method: "GET" })
	.validator(invoiceParamsSchema)
	.handler(async ({ data }) => {
		const session = await currentSession();
		return matchChoice<typeof session, Promise<InvoiceDetailView>>(session, {
			AnonymousSession: async () => ({ kind: "AnonymousInvoiceDetail" }),
			AuthenticatedSession: async ({ userId }) =>
				Result.match(decodeInvoiceParams(data), {
					/**
					 * 形式不正・存在しない・他アカウント所有を区別すると、URL の総当たりから
					 * 他人の請求 ID の存在を推測できるため、すべて InvoiceNotFound に落とす。
					 */
					err: async (): Promise<InvoiceDetailView> => ({
						kind: "InvoiceNotFound",
					}),
					ok: async (invoiceId): Promise<InvoiceDetailView> => {
						const loaded = await findInvoice(toAccountId(userId), invoiceId);
						return Result.match(loaded, {
							err: () => {
								// 読み取りの View は失敗の形を持たないため reject させ、クライアントの catch が INVOICE_DETAIL_UNAVAILABLE_MESSAGE を表示する。
								// StoreError の reason は内部情報なので例外にも載せない。
								throw new Error();
							},
							ok: (invoice): InvoiceDetailView =>
								invoice === null
									? { kind: "InvoiceNotFound" }
									: {
											kind: "InvoiceFound",
											invoice: encodeInvoiceDetailView(invoice),
										},
						});
					},
				}),
		});
	});

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
