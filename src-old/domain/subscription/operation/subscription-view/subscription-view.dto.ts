import { type Case, matchChoice } from "#/domain/building-blocks";
import {
	billedPlanId,
	type Invoice,
	type InvoicePurpose,
} from "#/domain/subscription/model/invoice.entity";
import {
	Amount,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Plan, type PlanChange } from "#/domain/subscription/model/plan.entity";
import type { PlanId } from "#/domain/subscription/model/plan.model";
import {
	MonthlyPrice,
	PlanName,
} from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.entity";
import {
	PeriodEndsAt,
	TrialEndsAt,
} from "#/domain/subscription/model/subscription.primitive";

// ===========================================================================
// encode（ドメイン → DTO）
// ===========================================================================

/** Subscription と Invoice の一覧 → 編集画面専用の表示モデル。 */
export const SubscriptionView = {
	encode: (
		subscription: Subscription,
		invoices: Invoice[],
	): SubscriptionView => ({
		kind: "SubscriptionFound",
		state: encodeState(subscription),
		invoices: invoices.map(encodeInvoice),
	}),
};

/**
 * 永続化された契約情報を読めなかったときの文言。
 * ドメインのエラーではなく、境界層がストアの失敗を受けたときに使う。
 * 内部の理由（どの列が NULL だったか）は画面に出さない。
 */
export const SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE =
	"契約情報を読み込めませんでした";
export const SUBSCRIPTION_LOGIN_REQUIRED_MESSAGE = "ログインしてください。";
export const NO_INVOICES_MESSAGE = "請求はありません。";

/** DTO に出す識別子。画面がプラン変更の要求に使うため、ドメインの判別子と同じ文字列にする。 */
const planIdValue = (planId: PlanId): string =>
	matchChoice<PlanId, string>(planId, {
		Basic: () => "Basic",
		Pro: () => "Pro",
	});

const purposeLabel = (purpose: InvoicePurpose): string =>
	matchChoice<InvoicePurpose, string>(purpose, {
		New: () => "新規",
		Renewal: () => "更新",
		UpgradeDifference: () => "アップグレード差額",
	});

const planOptions = (
	currentPlanId: PlanId,
	changeDescription: (nextPlanId: PlanId) => string,
): PlanOptionView[] =>
	Plan.all().map((plan) => {
		const view: PlanView = {
			id: planIdValue(plan.id),
			name: PlanName.value(plan.name),
			monthlyPrice: MonthlyPrice.value(plan.monthlyPrice),
		};
		return currentPlanId.kind === plan.id.kind
			? { kind: "CurrentPlan", ...view }
			: {
					kind: "ChangeablePlan",
					...view,
					changeDescription: changeDescription(plan.id),
				};
	});

const encodeState = (subscription: Subscription): SubscriptionStateView =>
	matchChoice<Subscription, SubscriptionStateView>(subscription, {
		FreeSubscription: () => ({
			kind: "Free",
			statusLabel: "無料プラン",
			notice: "無料プラン利用中",
		}),
		TrialSubscription: (current) => ({
			kind: "Trial",
			statusLabel: "トライアル中",
			planName: PlanName.value(Plan.of(current.planId).name),
			trialEndsAt: TrialEndsAt.value(current.trialEndsAt).toLocaleString(
				"ja-JP",
			),
			planOptions: planOptions(current.planId, () => "トライアル終了→請求"),
		}),
		PendingPaymentSubscription: (current) => ({
			kind: "PendingPayment",
			statusLabel: "支払い待ち",
			planName: PlanName.value(Plan.of(current.planId).name),
			notice: "支払い待ちの請求があります。下の一覧から支払ってください。",
		}),
		PaidSubscription: (current) => ({
			kind: "Paid",
			statusLabel: "有料契約中",
			planName: PlanName.value(Plan.of(current.planId).name),
			periodEndsAt: PeriodEndsAt.value(current.periodEndsAt).toLocaleString(
				"ja-JP",
			),
			planOptions: planOptions(current.planId, (nextPlanId) =>
				paidPlanChangeDescription(current.planId, nextPlanId),
			),
		}),
		UpgradePendingSubscription: (current) => ({
			kind: "UpgradePending",
			statusLabel: "有料契約中",
			planName: PlanName.value(Plan.of(current.planId).name),
			periodEndsAt: PeriodEndsAt.value(current.periodEndsAt).toLocaleString(
				"ja-JP",
			),
		}),
		CancelReservedSubscription: (current) => ({
			kind: "CancelReserved",
			statusLabel: "有料契約中",
			planName: PlanName.value(Plan.of(current.planId).name),
			periodEndsAt: PeriodEndsAt.value(current.periodEndsAt).toLocaleString(
				"ja-JP",
			),
			bookingText: "解約を予約中",
		}),
		PlanChangeReservedSubscription: (current) => ({
			kind: "PlanChangeReserved",
			statusLabel: "有料契約中",
			planName: PlanName.value(Plan.of(current.planId).name),
			periodEndsAt: PeriodEndsAt.value(current.periodEndsAt).toLocaleString(
				"ja-JP",
			),
			bookingText: `${PlanName.value(Plan.of(current.nextPlanId).name)}へ期間満了時に変更予約中`,
		}),
	});

const paidPlanChangeDescription = (
	currentPlanId: PlanId,
	nextPlanId: PlanId,
): string =>
	matchChoice<PlanChange, string>(Plan.change(currentPlanId, nextPlanId), {
		Upgrade: ({ difference }) =>
			`アップグレード（差額 ¥${Amount.value(difference).toLocaleString()} の請求）`,
		Downgrade: () => "ダウングレード（期間満了時に切替）",
	});

const encodeInvoiceRow = (invoice: Invoice): InvoiceRowView => ({
	id: InvoiceId.value(invoice.id),
	purposeLabel: purposeLabel(invoice.purpose),
	planName: PlanName.value(Plan.of(billedPlanId(invoice.purpose)).name),
	amount: Amount.value(invoice.amount),
	statusLabel: matchChoice<Invoice, string>(invoice, {
		UnpaidInvoice: () => "未払い",
		PaidInvoice: () => "支払い済み",
		FailedInvoice: () => "失敗",
	}),
	issuedAt: IssuedAt.value(invoice.issuedAt).toLocaleString("ja-JP"),
});

const encodeInvoice = (invoice: Invoice): InvoiceView =>
	matchChoice<Invoice, InvoiceView>(invoice, {
		UnpaidInvoice: (current) => ({
			kind: "Unpaid",
			...encodeInvoiceRow(current),
		}),
		PaidInvoice: (current) => ({ kind: "Paid", ...encodeInvoiceRow(current) }),
		FailedInvoice: (current) => ({
			kind: "Failed",
			...encodeInvoiceRow(current),
		}),
	});

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

/** 契約の状態。状態ごとに、その状態で意味を持つ値だけを持つ。 */
export type SubscriptionStateView =
	| Case<"Free", { statusLabel: string; notice: string }>
	| Case<
			"Trial",
			{
				statusLabel: string;
				planName: string;
				trialEndsAt: string;
				planOptions: PlanOptionView[];
			}
	  >
	| Case<
			"PendingPayment",
			{ statusLabel: string; planName: string; notice: string }
	  >
	| Case<
			"Paid",
			{
				statusLabel: string;
				planName: string;
				periodEndsAt: string;
				planOptions: PlanOptionView[];
			}
	  >
	| Case<
			"UpgradePending",
			{ statusLabel: string; planName: string; periodEndsAt: string }
	  >
	| Case<
			"CancelReserved",
			{
				statusLabel: string;
				planName: string;
				periodEndsAt: string;
				bookingText: string;
			}
	  >
	| Case<
			"PlanChangeReserved",
			{
				statusLabel: string;
				planName: string;
				periodEndsAt: string;
				bookingText: string;
			}
	  >;

/**
 * プラン変更の選択肢。プラン変更を受け付ける状態（Trial / Paid）だけが持つ。
 * 変更できるかは case で表し、フラグを持たない。
 */
export type PlanOptionView =
	| Case<"CurrentPlan", PlanView>
	| Case<"ChangeablePlan", PlanView & { changeDescription: string }>;

export type PlanView = { id: string; name: string; monthlyPrice: number };

/** 請求の 1 行。支払いの状態で case を分ける。支払い操作は Unpaid のときだけ出す。 */
export type InvoiceView =
	| Case<"Unpaid", InvoiceRowView>
	| Case<"Paid", InvoiceRowView>
	| Case<"Failed", InvoiceRowView>;

export type InvoiceRowView = {
	id: string;
	purposeLabel: string;
	planName: string;
	amount: number;
	statusLabel: string;
	issuedAt: string;
};

export type SubscriptionView =
	| Case<"AnonymousSubscription">
	| Case<"SubscriptionUnavailable">
	| Case<
			"SubscriptionFound",
			{ state: SubscriptionStateView; invoices: InvoiceView[] }
	  >;
