import type { Case } from "#/domain/building-blocks";
import type {
	FailedInvoice,
	PaidInvoice,
	UnpaidInvoice,
} from "#/domain/subscription/model/invoice.entity";
import type {
	FreeSubscription,
	PaidSubscription,
	PendingPaymentSubscription,
	UpgradePendingSubscription,
} from "#/domain/subscription/model/subscription.entity";

// ===========================================================================
// 入力
// ===========================================================================

/** 支払いを待っている契約。新規契約の支払い待ちと、アップグレード差額の支払い待ちの 2 つ。 */
export type AwaitingPaymentSubscription =
	| PendingPaymentSubscription
	| UpgradePendingSubscription;

/**
 * 支払える組み合わせ。未払いの請求と、その請求を待っている契約。
 * asPayable を通らないと作れないので、課金と状態遷移は照合済みの組だけを受け取る。
 */
export type Payable = {
	invoice: UnpaidInvoice;
	subscription: AwaitingPaymentSubscription;
};

/** 決済サービスの結果。ChargeInvoice ポートの実装が返す。 */
export type PaymentOutcome = Case<"Succeeded"> | Case<"Failed">;

// ===========================================================================
// イベント
// ===========================================================================

/** 支払いの結果。成否で請求と契約の行き先が決まるので Case で分ける。 */
export type PaymentSettled = PaymentSucceeded | PaymentFailed;

/** 支払いが成立した。契約は有料になる。 */
export type PaymentSucceeded = Case<
	"PaymentSucceeded",
	{ subscription: PaidSubscription; invoice: PaidInvoice }
>;

/**
 * 決済が拒否された。新規契約の支払い待ちなら無料に戻り、
 * アップグレード差額なら変更前のプランで有料のまま残る。
 */
export type PaymentFailed = Case<
	"PaymentFailed",
	{ subscription: FreeSubscription | PaidSubscription; invoice: FailedInvoice }
>;

// ===========================================================================
// エラー
// ===========================================================================

export type PayInvoiceError =
	| InvoiceNotFound
	| InvoiceAlreadyProcessed
	| NoPendingPayment
	| NotPendingInvoice;

/**
 * 決済ゲートウェイに到達できなかった、業務上の結果ではない境界の失敗。
 * 決済が拒否されたこと（PaymentOutcome の Failed）とは別で、請求を失敗として確定させない。
 */
export type PaymentGatewayError = Case<
	"PaymentGatewayUnavailable",
	{ reason: string }
>;

export const PaymentGatewayError = {
	paymentGatewayUnavailable: (reason: string): PaymentGatewayError => ({
		kind: "PaymentGatewayUnavailable",
		reason,
	}),
};

/** 支払い対象の請求が存在しない。 */
export type InvoiceNotFound = Case<"InvoiceNotFound">;

/** 支払い済みまたは失敗済みの請求は再処理しない。 */
export type InvoiceAlreadyProcessed = Case<"InvoiceAlreadyProcessed">;

/** 契約に処理対象となる支払い待ち状態がない。 */
export type NoPendingPayment = Case<"NoPendingPayment">;

/** 契約が待っているのは別の請求である。古い請求や他の契約の請求では支払えない。 */
export type NotPendingInvoice = Case<"NotPendingInvoice">;
