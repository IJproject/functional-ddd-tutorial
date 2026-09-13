import { type Case, matchChoice } from "#/domain/building-blocks";
import type { PlanView } from "#/domain/subscription/dto/apply.dto";
import type {
	Invoice,
	InvoicePurpose,
} from "#/domain/subscription/model/invoice.model";
import {
	Amount,
	InvoiceId,
	IssuedAt,
} from "#/domain/subscription/model/invoice.primitive";
import { Plan } from "#/domain/subscription/model/plan.model";
import {
	MonthlyPrice,
	PlanId,
} from "#/domain/subscription/model/plan.primitive";
import type { Subscription } from "#/domain/subscription/model/subscription.model";
import {
	PeriodEndsAt,
	TrialEndsAt,
} from "#/domain/subscription/model/subscription.primitive";

// ===========================================================================
// 型定義
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

/** ホーム画面のように、契約の要約だけが要る画面のための表示モデル。 */
export type SubscriptionSummaryView = {
	statusLabel: string;
	/** 契約中のプラン名。FreeSubscription なら null。 */
	planName: string | null;
};

export type SubscriptionPlanView = PlanView & {
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
	| { loggedIn: false }
	| {
			loggedIn: true;
			state: SubscriptionStateView;
			plans: SubscriptionPlanView[];
			invoices: InvoiceView[];
	  };

// ===========================================================================
// 実装
// ===========================================================================

/**
 * 永続化された契約情報を読めなかったときの文言。
 * ドメインのエラーではなく、境界層がストアの失敗を受けたときに使う。
 * 内部の理由（どの列が NULL だったか）は画面に出さない。
 */
export const STORE_UNAVAILABLE_MESSAGE = "契約情報を読み込めませんでした";

/** 編集画面に表示する固定文言。UI は境界層が用意した文言だけを描画する。 */
export const SUBSCRIPTION_EDIT_TEXT = {
	loadFailed: "エラーが発生しました",
	operationFailed: "操作に失敗しました",
	loginRequired: "ログインしてください",
	loading: "読み込み中...",
	loginRequiredDescription: "ログインしてください。",
	loginLink: "ログインへ",
	kicker: "サブスクリプション",
	contractTitle: "契約",
	trialEndLabel: "トライアル終了日:",
	periodEndLabel: "期間満了日:",
	cancelTrial: "トライアルを解約する",
	applyLink: "サブスクを申し込む",
	reserveCancellation: "解約を予約する",
	changePlanTitle: "プラン変更",
	applyFirst: "先にサブスクを申し込んでください。",
	applyNavigation: "申し込みへ",
	currentPlanLabel: "現在のプラン:",
	changePlan: "変更する",
	invoicesTitle: "請求一覧",
	paymentSimulationDescription: "決済サービスの代わりに手動で結果を入れます。",
	paymentSucceeded: "（模擬）支払い成功",
	paymentFailed: "（模擬）支払い失敗",
	noInvoices: "請求はありません。",
	simulationTitle: "開発用シミュレーション",
	endTrial: "（模擬）トライアル終了日を迎える",
	endPeriod: "（模擬）期間満了日を迎える",
	otherScreens: "他の画面へ:",
	applyShort: "申し込み",
} as const;

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
			planName: planName(current.planId),
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
			planName: planName(current.planId),
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
				planName: planName(current.planId),
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
			planName: planName(current.planId),
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
				planName: planName(current.planId),
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
				nextPlanName: planName(current.nextPlanId),
			};
			return {
				statusLabel: "有料契約中",
				planName: planName(current.planId),
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

/**
 * 契約状態の要約。編集画面と同じ判定を使うので、状態の表示名が画面間でずれない。
 */
export const encodeSubscriptionSummary = (
	subscription: Subscription,
): SubscriptionSummaryView => {
	const { statusLabel, planName } = encodeState(subscription);
	return { statusLabel, planName };
};

const changeDescription = (
	subscription: Subscription,
	nextPlanId: PlanId,
): string =>
	matchChoice<Subscription, string>(subscription, {
		FreeSubscription: () => "ダウングレード（期間満了時に切替）",
		TrialSubscription: () => "トライアル終了→請求",
		PendingPaymentSubscription: (current) => {
			const difference = Plan.priceDifference(current.planId, nextPlanId);
			return difference > 0
				? `アップグレード（差額 ¥${difference.toLocaleString()} の請求）`
				: "ダウングレード（期間満了時に切替）";
		},
		PaidSubscription: (current) => {
			const difference = Plan.priceDifference(current.planId, nextPlanId);
			return difference > 0
				? `アップグレード（差額 ¥${difference.toLocaleString()} の請求）`
				: "ダウングレード（期間満了時に切替）";
		},
		UpgradePendingSubscription: (current) => {
			const difference = Plan.priceDifference(current.planId, nextPlanId);
			return difference > 0
				? `アップグレード（差額 ¥${difference.toLocaleString()} の請求）`
				: "ダウングレード（期間満了時に切替）";
		},
		CancelReservedSubscription: (current) => {
			const difference = Plan.priceDifference(current.planId, nextPlanId);
			return difference > 0
				? `アップグレード（差額 ¥${difference.toLocaleString()} の請求）`
				: "ダウングレード（期間満了時に切替）";
		},
		PlanChangeReservedSubscription: (current) => {
			const difference = Plan.priceDifference(current.planId, nextPlanId);
			return difference > 0
				? `アップグレード（差額 ¥${difference.toLocaleString()} の請求）`
				: "ダウングレード（期間満了時に切替）";
		},
	});

const samePlan = (subscription: Subscription, planId: PlanId): boolean =>
	matchChoice<Subscription, boolean>(subscription, {
		FreeSubscription: () => false,
		TrialSubscription: (current) =>
			PlanId.value(current.planId) === PlanId.value(planId),
		PendingPaymentSubscription: (current) =>
			PlanId.value(current.planId) === PlanId.value(planId),
		PaidSubscription: (current) =>
			PlanId.value(current.planId) === PlanId.value(planId),
		UpgradePendingSubscription: (current) =>
			PlanId.value(current.planId) === PlanId.value(planId),
		CancelReservedSubscription: (current) =>
			PlanId.value(current.planId) === PlanId.value(planId),
		PlanChangeReservedSubscription: (current) =>
			PlanId.value(current.planId) === PlanId.value(planId),
	});

const encodeInvoice = (invoice: Invoice): InvoiceView =>
	matchChoice<Invoice, InvoiceView>(invoice, {
		UnpaidInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: planName(current.planId),
			amount: Amount.value(current.amount),
			statusLabel: "未払い",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
			payable: true,
		}),
		PaidInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: planName(current.planId),
			amount: Amount.value(current.amount),
			statusLabel: "支払い済み",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
			payable: false,
		}),
		FailedInvoice: (current) => ({
			id: InvoiceId.value(current.id),
			purposeLabel: purposeLabel(current.purpose),
			planName: planName(current.planId),
			amount: Amount.value(current.amount),
			statusLabel: "失敗",
			issuedAt: IssuedAt.value(current.issuedAt).toLocaleString("ja-JP"),
			payable: false,
		}),
	});

/** Subscription と Invoice の一覧 → 編集画面専用の表示モデル。 */
export const encodeSubscriptionView = (
	subscription: Subscription,
	invoices: Invoice[],
): SubscriptionView => {
	const state = encodeState(subscription);
	return {
		loggedIn: true,
		state,
		plans: Plan.all().map((plan) => ({
			id: PlanId.value(plan.id),
			name: planName(plan.id),
			monthlyPrice: MonthlyPrice.value(plan.monthlyPrice),
			changeDescription: changeDescription(subscription, plan.id),
			changeDisabled: !state.canChangePlan || samePlan(subscription, plan.id),
		})),
		invoices: invoices.map(encodeInvoice),
	};
};
