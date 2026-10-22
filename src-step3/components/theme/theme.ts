export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/** mode と OS 設定から、実際に適用する 2 値を決める。 */
export function resolveTheme(
	mode: ThemeMode,
	prefersDark: boolean,
): ResolvedTheme {
	return mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
}

/** localStorage から読む。SSR / 未設定 / 不正値はすべて "auto"。 */
export function readStoredMode(): ThemeMode {
	if (typeof window === "undefined") {
		return "auto";
	}

	const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
	if (stored === "light" || stored === "dark" || stored === "auto") {
		return stored;
	}

	return "auto";
}

/** localStorage へ書く。 */
export function storeMode(mode: ThemeMode): void {
	window.localStorage.setItem(THEME_STORAGE_KEY, mode);
}

/** document.documentElement へ class / data-theme / colorScheme を適用する。 */
export function applyThemeMode(mode: ThemeMode): void {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = resolveTheme(mode, prefersDark);

	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);

	document.documentElement.setAttribute("data-theme", resolved);

	document.documentElement.style.colorScheme = resolved;
}

/** 次のモードを返す。light → dark → auto → light。 */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
	return mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
}

/**
 * ハイドレーション前に <head> で同期実行させるスクリプト本体。
 * モジュールを import できない実行環境のため、ロジックを文字列として持つのはやむを得ない。
 * キー名の drift だけは THEME_STORAGE_KEY の補間で防ぐ。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('${THEME_STORAGE_KEY}');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);root.setAttribute('data-theme',resolved);root.style.colorScheme=resolved;}catch(e){}})();`;
