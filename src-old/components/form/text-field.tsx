import { useId } from "react";
import { ErrorText } from "#/components/feedback/error-text";

export type TextFieldProps = {
	label: string;
	name: string;
	/** 既定は "text"。 */
	type?: "text" | "email" | "password";
	required?: boolean;
	minLength?: number;
	/** 既定は空配列。1件以上で aria-invalid が立ち、ErrorText が出る。 */
	errors?: readonly string[];
};

export function TextField({
	label,
	name,
	type = "text",
	required,
	minLength,
	errors = [],
}: TextFieldProps) {
	const errorId = useId();
	const invalid = errors.length > 0;

	return (
		<label className="block">
			{label}
			<input
				name={name}
				type={type}
				required={required}
				minLength={minLength}
				className="demo-input mt-1 w-full"
				aria-invalid={invalid}
				aria-describedby={invalid ? errorId : undefined}
			/>
			{invalid && <ErrorText id={errorId}>{errors.join(" / ")}</ErrorText>}
		</label>
	);
}
