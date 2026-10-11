import type { ReactNode } from "react";

/** バッジの意味合い。色そのものではなく、どういう性質の情報かを表す。 */
export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger";

type BadgeProps = {
	/** 既定は "neutral"。 */
	tone?: BadgeTone;
	children: ReactNode;
};

const TONE_CLASS: Record<BadgeTone, string> = {
	neutral: "demo-badge",
	info: "demo-badge-info",
	warning: "demo-badge-warning",
	success: "demo-badge-success",
	danger: "demo-badge-danger",
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
	return <span className={TONE_CLASS[tone]}>{children}</span>;
}
