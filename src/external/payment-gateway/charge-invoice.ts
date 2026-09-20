import { InvoiceId } from "#/domain/subscription/model/invoice.primitive";
import type { ChargeInvoice } from "#/domain/subscription/operation/payment/payment.workflow";

/**
 * ドメインの ChargeInvoice ポートを満たす開発用のフェイク実装。
 *
 * 実際の決済サービスは呼ばず、請求 ID から成否を決める。Stripe のテスト用カード番号
 * （4242... は成功、...0002 は拒否）と同じ考え方で、外から見て挙動が予測できるようにしている。
 *
 * 乱数を使わないのは、同じ請求に対して常に同じ結果を返すためである。
 *
 * 金額ではなく請求 ID で判定しているのは、Invoice が New / Renewal の請求額を料金表と
 * 突き合わせて検証しており（invoice.entity.ts）、請求額がプランの価格と差額の数種類しか
 * 取り得ないためである。判定用の金額を作れないので、ID を印に使っている。
 *
 * 実サービスへ差し替えるときは、このファイルだけを置き換える。
 */
export const chargeInvoice: ChargeInvoice = async (invoice) =>
	InvoiceId.value(invoice.id).includes(FAILING_INVOICE_MARKER)
		? { kind: "Failed" }
		: { kind: "Succeeded" };

/** この文字列を請求 ID に含めると決済が失敗する。seed がこの印を使う。 */
const FAILING_INVOICE_MARKER = "-fail";
