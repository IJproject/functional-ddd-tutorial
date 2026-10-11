import type { ReactElement } from "react";

export type AlertTone = "danger" | "warning";

export function Alert({
	tone = "danger",
	messages,
}: {
	tone?: AlertTone;
	messages: readonly string[];
}): ReactElement | null {
	if (messages.length === 0) {
		return null;
	}

	const className =
		tone === "danger" ? "demo-alert demo-alert-danger" : "demo-alert";

	return (
		<div className={className}>
			{messages.map((message) => (
				<p key={message}>{message}</p>
			))}
		</div>
	);
}
