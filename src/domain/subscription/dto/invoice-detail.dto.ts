import * as z from "zod";
import {
	type Case,
	err,
	matchChoice,
	ok,
	type Result as ResultType,
} from "#/domain/building-blocks";
import type {
	Invoice,
	InvoicePurpose,
} from "#/domain/subscription/model/invoice.model";
import {
	Amount,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { PlanId } from "#/domain/subscription/model/plan.primitive";

// ===========================================================================
// 型定義
// ===========================================================================

/**
 * URL のパスパラメータ。ルータが渡してくるのは常に string なので、
 * ここでは形を受けるだけにして、UUID かどうかの判定は decode 側で行う。
 */
export const invoiceParamsSchema = z.object({ invoiceId: z.string() });
export type InvoiceParams = z.infer<typeof invoiceParamsSchema>;

/** 境界で受け取った請求 ID が UUID の形式ではない。 */
export type MalformedInvoiceId = Case<"MalformedInvoiceId">;

/** 詳細画面に出す1件の請求。一覧行（InvoiceView）と違い payable を持たない（表示専用のため）。 */
export type InvoiceDetailItemView = {
	/** 一覧では出さない請求 ID の全文。URL と突き合わせられるように出す。 */
	id: string;
	purposeLabel: string;
	planName: string;
	amount: number;
	statusLabel: string;
	/** 状態ごとの説明文。UI に if を持ち込まないため境界層で文にしておく。 */
	statusDescription: string;
	issuedAt: string;
};

/**
 * この画面には未ログイン・見つからない・見つかったの3状態がある。
 * boolean フラグ2本では、未ログインかつ発見済みというありえない組み合わせも型上表現できるため、
 * Case の union で有効な3状態だけを表す。
 */
export type InvoiceDetailView =
	| Case<"AnonymousInvoiceDetail">
	| Case<"InvoiceNotFound">
	| Case<"InvoiceFound", { invoice: InvoiceDetailItemView }>;

// ===========================================================================
// 実装
// ===========================================================================

/** 請求詳細画面に表示する固定文言。UI は境界層が用意した文言だけを描画する。 */
export const INVOICE_DETAIL_TEXT = {
	kicker: "サブスクリプション",
	title: "請求の詳細",
	loading: "読み込み中...",
	loginRequiredDescription: "ログインしてください。",
	loginLink: "ログインへ",
	notFoundTitle: "請求が見つかりません",
	notFoundDescription: "指定された請求を確認できませんでした。",
	backToEdit: "契約へ戻る",
	invoiceIdLabel: "請求 ID",
	amountLabel: "金額",
	issuedAtLabel: "発行日時",
	purposeLabel: "請求理由",
	planLabel: "プラン",
	statusLabel: "状態",
} as const;

/**
 * InvoiceId.create は crypto.randomUUID() の結果を受ける信頼境界の内側の入口であり、
 * 検証の責務は境界 DTO 側にある。規則 A に従い、検証するこちらは Result を返す。
 */
export const decodeInvoiceParams = (
	params: InvoiceParams,
): ResultType<InvoiceId, MalformedInvoiceId> => {
	const parsed = z.uuid().safeParse(params.invoiceId);
	return parsed.success
		? ok(InvoiceId.create(parsed.data))
		: err({ kind: "MalformedInvoiceId" });
};

const planName = (planId: PlanId): string =>
	matchChoice<{ kind: "Basic" } | { kind: "Pro" }, string>(
		{ kind: PlanId.value(planId) },
		{
			Basic: () => "ベーシック",
			Pro: () => "プロ",
		},
	);

const purposeLabel = (purpose: InvoicePurpose): string =>
	matchChoice<InvoicePurpose, string>(purpose, {
		New: () => "新規",
		Renewal: () => "更新",
		UpgradeDifference: () => "アップグレード差額",
	});

export const encodeInvoiceDetail = (invoice: Invoice): InvoiceDetailItemView =>
	matchChoice<Invoice, InvoiceDetailItemView>(invoice, {
		UnpaidInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: planName(current.planId),
			amount: Amount.value(current.amount),
			statusLabel: "未払い",
			statusDescription: "契約画面から支払いを実行できます。",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
		}),
		PaidInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: planName(current.planId),
			amount: Amount.value(current.amount),
			statusLabel: "支払い済み",
			statusDescription: "この請求は決済済みです。",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
		}),
		FailedInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: planName(current.planId),
			amount: Amount.value(current.amount),
			statusLabel: "失敗",
			statusDescription: "決済に失敗しています。契約画面から再実行できます。",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
		}),
	});
