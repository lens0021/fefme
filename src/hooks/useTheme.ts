import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

/**
 * Hook to detect and track system color scheme preference
 * @returns current theme mode ("light" or "dark")
 */
export function useTheme(): ThemeMode {
	const [theme, setTheme] = useState<ThemeMode>(() => {
		if (typeof window === "undefined") return "light";
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	});

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		const handleChange = (e: MediaQueryListEvent) => {
			setTheme(e.matches ? "dark" : "light");
		};

		// Use modern API with fallback for Safari < 14
		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener("change", handleChange);
		} else {
			mediaQuery.addListener(handleChange);
		}

		return () => {
			if (mediaQuery.removeEventListener) {
				mediaQuery.removeEventListener("change", handleChange);
			} else {
				mediaQuery.removeListener(handleChange);
			}
		};
	}, []);

	// Apply theme to document root
	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
	}, [theme]);

	return theme;
}
