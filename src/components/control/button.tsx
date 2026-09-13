import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

type ButtonBase = {
	/** 既定は "primary"。 */
	variant?: ButtonVariant;
	/** 余白など、配置のためのクラスだけを受け取る。見た目は variant が決める。 */
	className?: string;
	children: ReactNode;
};

/**
 * kind は「押すと何が起きるか」を表す選択型。
 * 見た目を決める variant と、振る舞いを決める kind は直交する。
 */
export type ButtonProps = ButtonBase &
	(
		| { kind: "submit"; disabled?: boolean }
		| { kind: "action"; onClick: () => void; disabled?: boolean }
		| { kind: "link"; to: LinkProps["to"] }
	);

const VARIANT_CLASS: Record<ButtonVariant, string> = {
	primary: "demo-button",
	secondary: "demo-button-secondary",
	danger: "demo-button-danger",
};

function buttonClassName(variant: ButtonVariant, className?: string): string {
	return [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
}

export function Button(props: ButtonProps) {
	const { variant = "primary", className, children } = props;
	const cls = buttonClassName(variant, className);

	switch (props.kind) {
		case "submit":
			return (
				<button type="submit" disabled={props.disabled} className={cls}>
					{children}
				</button>
			);
		case "action":
			return (
				<button
					type="button"
					onClick={props.onClick}
					disabled={props.disabled}
					className={cls}
				>
					{children}
				</button>
			);
		case "link":
			return (
				<Link to={props.to} className={cls}>
					{children}
				</Link>
			);
	}
}
