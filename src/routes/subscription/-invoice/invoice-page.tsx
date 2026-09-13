import { getRouteApi, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type ReactNode, useEffect, useState } from "react";
import { Alert } from "#/components/feedback/alert";
import { UserId } from "#/domain/auth/model/user.primitive";
import { matchChoice, Result } from "#/domain/building-blocks";
import {
	decodeInvoiceParams,
	encodeInvoiceDetail,
	INVOICE_DETAIL_TEXT,
	type InvoiceDetailView,
	invoiceParamsSchema,
} from "#/domain/subscription/dto/invoice-detail.dto";
import { STORE_UNAVAILABLE_MESSAGE } from "#/domain/subscription/dto/subscription-view.dto";
import { AccountId } from "#/domain/subscription/model/account.primitive";
import { currentSession } from "#/external/better-auth/current-session";
import { findInvoice } from "#/external/subscription-store/subscription-store";

/**
 * 動的セグメントはフラットルート側へ置き、ページ本体は既存の -<ページ>/<ページ>-page 規則に揃える。
 * ルートが InvoicePage を import するため、ここでは Route の直接 import による循環参照を避けて getRouteApi を使う。
 */
const routeApi = getRouteApi("/subscription/invoice/$invoiceId");

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
								// StoreError の reason は内部情報なので画面へ運ばない。
								throw new Error(STORE_UNAVAILABLE_MESSAGE);
							},
							ok: (invoice): InvoiceDetailView =>
								invoice === null
									? { kind: "InvoiceNotFound" }
									: {
											kind: "InvoiceFound",
											invoice: encodeInvoiceDetail(invoice),
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
			.catch(() => setErrors([STORE_UNAVAILABLE_MESSAGE]));
	}, [invoiceId]);

	const errorAlert = <Alert messages={errors} />;
	if (!view)
		return (
			<main className="demo-page">
				<section className="demo-panel">
					{errors.length > 0 ? errorAlert : INVOICE_DETAIL_TEXT.loading}
				</section>
			</main>
		);

	const content = matchChoice<InvoiceDetailView, ReactNode>(view, {
		AnonymousInvoiceDetail: () => (
			<>
				<p>{INVOICE_DETAIL_TEXT.loginRequiredDescription}</p>
				<Link to="/auth/login">{INVOICE_DETAIL_TEXT.loginLink}</Link>
			</>
		),
		InvoiceNotFound: () => (
			<>
				<h2 className="demo-title">{INVOICE_DETAIL_TEXT.notFoundTitle}</h2>
				<p className="demo-muted">{INVOICE_DETAIL_TEXT.notFoundDescription}</p>
				<Link to="/subscription/edit">{INVOICE_DETAIL_TEXT.backToEdit}</Link>
			</>
		),
		InvoiceFound: ({ invoice }) => (
			<>
				<article className="demo-card">
					<p>
						<strong>{INVOICE_DETAIL_TEXT.invoiceIdLabel}:</strong> {invoice.id}
					</p>
					<p>
						<strong>{INVOICE_DETAIL_TEXT.purposeLabel}:</strong>{" "}
						{invoice.purposeLabel}
					</p>
					<p>
						<strong>{INVOICE_DETAIL_TEXT.planLabel}:</strong> {invoice.planName}
					</p>
					<p>
						<strong>{INVOICE_DETAIL_TEXT.amountLabel}:</strong> ¥
						{invoice.amount.toLocaleString()}
					</p>
					<p>
						<strong>{INVOICE_DETAIL_TEXT.statusLabel}:</strong>{" "}
						{invoice.statusLabel}
					</p>
					<p className="demo-muted">{invoice.statusDescription}</p>
					<p>
						<strong>{INVOICE_DETAIL_TEXT.issuedAtLabel}:</strong>{" "}
						{invoice.issuedAt}
					</p>
				</article>
				<Link to="/subscription/edit">{INVOICE_DETAIL_TEXT.backToEdit}</Link>
			</>
		),
	});

	return (
		<main className="demo-page">
			<section className="demo-panel">
				<p className="island-kicker">{INVOICE_DETAIL_TEXT.kicker}</p>
				<h1 className="demo-title">{INVOICE_DETAIL_TEXT.title}</h1>
				{errorAlert}
				{content}
			</section>
		</main>
	);
}
