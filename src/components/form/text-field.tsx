import { type ComponentProps, useId } from "react";

export type TextFieldProps = Omit<
	ComponentProps<"input">,
	"type" | "className" | "aria-invalid" | "aria-describedby"
> & {
	label: string;
	type?: "text" | "email" | "password";
	errors?: readonly string[];
};

export function TextField({
	label,
	type = "text",
	errors = [],
	...inputProps
}: TextFieldProps) {
	const errorId = useId();
	const invalid = errors.length > 0;

	return (
		<label className="block">
			{label}
			<input
				{...inputProps}
				type={type}
				className="demo-input mt-1 w-full"
				aria-invalid={invalid}
				aria-describedby={invalid ? errorId : undefined}
			/>
			{invalid && (
				<span id={errorId} className="demo-field-error">
					{errors.join(" / ")}
				</span>
			)}
		</label>
	);
}
