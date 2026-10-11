import { useEffect, useState } from "react";
import { Button } from "#/components/control/button";
import {
	applyThemeMode,
	nextThemeMode,
	readStoredMode,
	storeMode,
	type ThemeMode,
} from "#/components/theme/theme";

export default function ThemeToggle() {
	const [mode, setMode] = useState<ThemeMode>("auto");

	useEffect(() => {
		const initialMode = readStoredMode();
		setMode(initialMode);
		applyThemeMode(initialMode);
	}, []);

	useEffect(() => {
		if (mode !== "auto") {
			return;
		}

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyThemeMode("auto");

		media.addEventListener("change", onChange);
		return () => {
			media.removeEventListener("change", onChange);
		};
	}, [mode]);

	function toggleMode() {
		const nextMode = nextThemeMode(mode);
		setMode(nextMode);
		applyThemeMode(nextMode);
		storeMode(nextMode);
	}

	const label =
		mode === "auto"
			? "Theme mode: auto (system). Click to switch to light mode."
			: `Theme mode: ${mode}. Click to switch mode.`;

	return (
		<Button
			kind="action"
			variant="secondary"
			onClick={toggleMode}
			label={label}
		>
			{mode === "auto" ? "Auto" : mode === "dark" ? "Dark" : "Light"}
		</Button>
	);
}
