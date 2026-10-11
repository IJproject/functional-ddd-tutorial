import { ok } from "#/domain/building-blocks";
import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import type { PaymentOutcome } from "#/domain/subscription/operation/payment/payment.model";
import type { ChargeInvoice } from "#/domain/subscription/operation/payment/payment.workflow";

/**
 * ドメインの ChargeInvoice ポートを満たす開発用のフェイク実装。
 *
 * 実際の決済サービスは呼ばず、請求 ID から成否を決める。Stripe のテスト用カード番号
 * （4242... は成功、...0002 は拒否）と同じ考え方で、外から見て挙動が予測できるようにしている。
 *
 * 乱数を使わないのは、同じ請求に対して常に同じ結果を返すためである。
 *
 * 金額は発行時点の請求額として保存するため、テスト用の成否は特定の請求 ID で判定する。
 *
 * 実サービスへ差し替えるときは、このファイルだけを置き換える。
 */
export const chargeInvoice: ChargeInvoice = async (invoice) =>
	ok<PaymentOutcome>(
		InvoiceId.value(invoice.id) === FAILING_INVOICE_ID
			? { kind: "Failed" }
			: { kind: "Succeeded" },
	);

/** seed の失敗用請求と共有する固定 ID。 */
export const FAILING_INVOICE_ID = "00000000-0000-4000-8000-000000000003";
