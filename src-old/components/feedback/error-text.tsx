import type { ReactNode } from "react";

export function ErrorText({
	id,
	children,
}: {
	id?: string;
	children: ReactNode;
}) {
	return (
		<span id={id} className="demo-field-error">
			{children}
		</span>
	);
}
