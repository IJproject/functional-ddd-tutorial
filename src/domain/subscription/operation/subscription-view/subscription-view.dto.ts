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
	): SubscriptionView => {
		const state = encodeState(subscription);
		return {
			kind: "SubscriptionFound",
			state,
			plans: Plan.all().map((plan) => ({
				id: planIdValue(plan.id),
				name: PlanName.value(plan.name),
				monthlyPrice: MonthlyPrice.value(plan.monthlyPrice),
				changeDescription: changeDescription(subscription, plan.id),
				changeDisabled: !state.canChangePlan || samePlan(subscription, plan.id),
			})),
			invoices: invoices.map(encodeInvoice),
		};
	},
};

/**
 * 永続化された契約情報を読めなかったときの文言。
 * ドメインのエラーではなく、境界層がストアの失敗を受けたときに使う。
 * 内部の理由（どの列が NULL だったか）は画面に出さない。
 */
export const SUBSCRIPTION_VIEW_UNAVAILABLE_MESSAGE =
	"契約情報を読み込めませんでした";
export const SUBSCRIPTION_LOGIN_REQUIRED_MESSAGE = "ログインしてください。";
export const APPLY_BEFORE_PLAN_CHANGE_MESSAGE =
	"先にサブスクを申し込んでください。";
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

const reservationLabel = (reservation: ReservationView): string =>
	matchChoice<ReservationView, string>(reservation, {
		None: () => "予約なし",
		Cancel: () => "解約を予約中",
		PlanChange: ({ nextPlanName }) => `${nextPlanName}へ期間満了時に変更予約中`,
	});

const encodeState = (subscription: Subscription): SubscriptionStateView =>
	matchChoice<Subscription, SubscriptionStateView>(subscription, {
		FreeSubscription: () => ({
			statusLabel: "無料プラン",
			planName: null,
			trialEndsAt: null,
			periodEndsAt: null,
			reservation: { kind: "None" },
			bookingText: null,
			notice: "無料プラン利用中",
			showApplyLink: true,
			canChangePlan: false,
			canCancelTrial: false,
			canReserveCancellation: false,
			canEndTrial: false,
			canEndPeriod: false,
		}),
		TrialSubscription: (current) => ({
			statusLabel: "トライアル中",
			planName: PlanName.value(Plan.of(current.planId).name),
			trialEndsAt: TrialEndsAt.value(current.trialEndsAt).toLocaleString(
				"ja-JP",
			),
			periodEndsAt: null,
			reservation: { kind: "None" },
			bookingText: null,
			notice: null,
			showApplyLink: false,
			canChangePlan: true,
			canCancelTrial: true,
			canReserveCancellation: false,
			canEndTrial: true,
			canEndPeriod: false,
		}),
		PendingPaymentSubscription: (current) => ({
			statusLabel: "支払い待ち",
			planName: PlanName.value(Plan.of(current.planId).name),
			trialEndsAt: null,
			periodEndsAt: null,
			reservation: { kind: "None" },
			bookingText: null,
			notice: "支払い待ちの請求があります。下の一覧から支払ってください。",
			showApplyLink: false,
			canChangePlan: false,
			canCancelTrial: false,
			canReserveCancellation: false,
			canEndTrial: false,
			canEndPeriod: false,
		}),
		PaidSubscription: (current) => {
			const reservation: ReservationView = { kind: "None" };
			return {
				statusLabel: "有料契約中",
				planName: PlanName.value(Plan.of(current.planId).name),
				trialEndsAt: null,
				periodEndsAt: PeriodEndsAt.value(current.periodEndsAt).toLocaleString(
					"ja-JP",
				),
				reservation,
				bookingText: reservationLabel(reservation),
				notice: null,
				showApplyLink: false,
				canChangePlan: true,
				canCancelTrial: false,
				canReserveCancellation: true,
				canEndTrial: false,
				canEndPeriod: true,
			};
		},
		UpgradePendingSubscription: (current) => ({
			statusLabel: "有料契約中",
			planName: PlanName.value(Plan.of(current.planId).name),
			trialEndsAt: null,
			periodEndsAt: PeriodEndsAt.value(current.periodEndsAt).toLocaleString(
				"ja-JP",
			),
			reservation: { kind: "None" },
			bookingText: null,
			notice: null,
			showApplyLink: false,
			canChangePlan: false,
			canCancelTrial: false,
			canReserveCancellation: false,
			canEndTrial: false,
			canEndPeriod: false,
		}),
		CancelReservedSubscription: (current) => {
			const reservation: ReservationView = { kind: "Cancel" };
			return {
				statusLabel: "有料契約中",
				planName: PlanName.value(Plan.of(current.planId).name),
				trialEndsAt: null,
				periodEndsAt: PeriodEndsAt.value(current.periodEndsAt).toLocaleString(
					"ja-JP",
				),
				reservation,
				bookingText: reservationLabel(reservation),
				notice: null,
				showApplyLink: false,
				canChangePlan: false,
				canCancelTrial: false,
				canReserveCancellation: false,
				canEndTrial: false,
				canEndPeriod: true,
			};
		},
		PlanChangeReservedSubscription: (current) => {
			const reservation: ReservationView = {
				kind: "PlanChange",
				nextPlanName: PlanName.value(Plan.of(current.nextPlanId).name),
			};
			return {
				statusLabel: "有料契約中",
				planName: PlanName.value(Plan.of(current.planId).name),
				trialEndsAt: null,
				periodEndsAt: PeriodEndsAt.value(current.periodEndsAt).toLocaleString(
					"ja-JP",
				),
				reservation,
				bookingText: reservationLabel(reservation),
				notice: null,
				showApplyLink: false,
				canChangePlan: false,
				canCancelTrial: false,
				canReserveCancellation: true,
				canEndTrial: false,
				canEndPeriod: true,
			};
		},
	});

const changeDescription = (
	subscription: Subscription,
	nextPlanId: PlanId,
): string =>
	matchChoice<Subscription, string>(subscription, {
		FreeSubscription: () => "ダウングレード（期間満了時に切替）",
		TrialSubscription: () => "トライアル終了→請求",
		PendingPaymentSubscription: (current) =>
			paidPlanChangeDescription(current.planId, nextPlanId),
		PaidSubscription: (current) =>
			paidPlanChangeDescription(current.planId, nextPlanId),
		UpgradePendingSubscription: (current) =>
			paidPlanChangeDescription(current.planId, nextPlanId),
		CancelReservedSubscription: (current) =>
			paidPlanChangeDescription(current.planId, nextPlanId),
		PlanChangeReservedSubscription: (current) =>
			paidPlanChangeDescription(current.planId, nextPlanId),
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

const samePlan = (subscription: Subscription, planId: PlanId): boolean =>
	matchChoice<Subscription, boolean>(subscription, {
		FreeSubscription: () => false,
		TrialSubscription: (current) => current.planId.kind === planId.kind,
		PendingPaymentSubscription: (current) =>
			current.planId.kind === planId.kind,
		PaidSubscription: (current) => current.planId.kind === planId.kind,
		UpgradePendingSubscription: (current) =>
			current.planId.kind === planId.kind,
		CancelReservedSubscription: (current) =>
			current.planId.kind === planId.kind,
		PlanChangeReservedSubscription: (current) =>
			current.planId.kind === planId.kind,
	});

const encodeInvoice = (invoice: Invoice): InvoiceView =>
	matchChoice<Invoice, InvoiceView>(invoice, {
		UnpaidInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: PlanName.value(Plan.of(billedPlanId(current.purpose)).name),
			amount: Amount.value(current.amount),
			statusLabel: "未払い",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
			payable: true,
		}),
		PaidInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: PlanName.value(Plan.of(billedPlanId(current.purpose)).name),
			amount: Amount.value(current.amount),
			statusLabel: "支払い済み",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
			payable: false,
		}),
		FailedInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: PlanName.value(Plan.of(billedPlanId(current.purpose)).name),
			amount: Amount.value(current.amount),
			statusLabel: "失敗",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
			payable: false,
		}),
	});

// ===========================================================================
// 型定義（シリアライズ: DTO → JSON）
// ===========================================================================

export type ReservationView =
	| Case<"None">
	| Case<"Cancel">
	| Case<"PlanChange", { nextPlanName: string }>;

export type SubscriptionStateView = {
	/** 状態の表示名。 */
	statusLabel: string;
	/** 契約中のプラン名。FreeSubscription なら null。 */
	planName: string | null;
	/** 表示用に整形済みの日時。該当しない状態では null。 */
	trialEndsAt: string | null;
	periodEndsAt: string | null;
	reservation: ReservationView;
	/** 予約状態の表示文言。 */
	bookingText: string | null;
	/** 契約欄に出す案内。 */
	notice: string | null;
	/** 無料状態から申し込み画面へ案内するか。 */
	showApplyLink: boolean;
	/**
	 * ボタンの disabled を決めるための表示上の都合。
	 * 可否の最終的な権威はワークフロー側にあり、ここはその手前で操作を隠すだけ。
	 * どちらも同じ Subscription の Case から導くので二重管理にはならない。
	 */
	canChangePlan: boolean;
	canCancelTrial: boolean;
	canReserveCancellation: boolean;
	canEndTrial: boolean;
	canEndPeriod: boolean;
};

export type SubscriptionPlanView = {
	id: string;
	name: string;
	monthlyPrice: number;
	changeDescription: string;
	changeDisabled: boolean;
};

export type InvoiceView = {
	id: string;
	purposeLabel: string;
	planName: string;
	amount: number;
	statusLabel: string;
	issuedAt: string;
	/** 支払い操作を出すか。UnpaidInvoice のときだけ true。 */
	payable: boolean;
};

export type SubscriptionView =
	| Case<"AnonymousSubscription">
	| Case<"SubscriptionUnavailable">
	| Case<
			"SubscriptionFound",
			{
				state: SubscriptionStateView;
				plans: SubscriptionPlanView[];
				invoices: InvoiceView[];
			}
	  >;
