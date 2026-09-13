/**
 * この層の型は globalThis に置く永続化の形であり、ドメインの型とは別物。
 * 文字列の status や無料状態用の planId はこの外部層だけに閉じ込める。
 */

export type PlanId = "free" | "basic" | "pro";
export type Account = {
	id: string;
	billingAddress: string;
	paymentMethod: string;
	trialUsed: boolean;
	createdAt: string;
};
export type Subscription = {
	accountId: string;
	status: "free" | "trial" | "pending_payment" | "paid";
	planId: PlanId;
	trialEndsAt?: string;
	periodEndsAt?: string;
	reservation?: { kind: "cancel" } | { kind: "change_plan"; planId: PlanId };
	pendingInvoiceId?: string;
};
export type Invoice = {
	id: string;
	accountId: string;
	planId: PlanId;
	amount: number;
	kind: "new" | "renewal" | "upgrade_diff";
	status: "unpaid" | "paid" | "failed";
	createdAt: string;
};
export type Store = {
	accounts: Account[];
	subscriptions: Subscription[];
	invoices: Invoice[];
};

const globalStore = globalThis as { __subscStore?: Store };
globalStore.__subscStore ??= {
	accounts: [],
	subscriptions: [],
	invoices: [],
};

export const store: Store = globalStore.__subscStore;
