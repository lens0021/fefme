import { DEFAULT_FONT_SIZE } from "../../core/index";
/**
 * Theme configuration and color palettes for light/dark modes
 */
import type { CSSProperties } from "react";
import tinycolor from "tinycolor2";
import tinygradient from "tinygradient";

export type GradientEndpoints = [tinycolor.Instance, tinycolor.Instance];

export enum SwitchType {
	HIGHLIGHTS_ONLY = "highlightsOnly",
	INVERT_SELECTION = "invertSelection",
	SORT_BY_COUNT = "sortByCount",
}

// Conventional color palette for light/dark modes
export interface ColorPalette {
	// Core colors
	readonly background: CSSProperties["backgroundColor"];
	readonly foreground: CSSProperties["color"];
	readonly border: CSSProperties["borderColor"];
	readonly muted: CSSProperties["backgroundColor"];
	readonly mutedForeground: CSSProperties["color"];

	// Semantic colors
	readonly primary: CSSProperties["color"];
	readonly primaryForeground: CSSProperties["color"];
	readonly secondary: CSSProperties["color"];
	readonly secondaryForeground: CSSProperties["color"];
	readonly success: CSSProperties["color"];
	readonly warning: CSSProperties["color"];
	readonly danger: CSSProperties["color"];
	readonly info: CSSProperties["color"];

	// Component-specific
	readonly cardBackground: CSSProperties["backgroundColor"];
	readonly inputBackground: CSSProperties["backgroundColor"];
	readonly dmBackground: CSSProperties["backgroundColor"];
}

interface ThemeConfigBase {
	// Color palettes
	readonly light: ColorPalette;
	readonly dark: ColorPalette;

	// Feature-specific colors (use palette colors)
	readonly accordionOpenBlue: CSSProperties["color"];
	readonly followedTagColor: CSSProperties["color"];

	// Gradients
	readonly favouritedTagGradient: GradientEndpoints;
	readonly feedBackgrounGradient: GradientEndpoints;
	readonly followedUserGradient: GradientEndpoints;
	readonly participatedTagGradient: GradientEndpoints;
	readonly trendingTagGradient: GradientEndpoints;

	// Fonts
	readonly accountBioFontSize?: number;
	readonly defaultFontSize: number;
	readonly errorFontSize: number;
	readonly footerHashtagsFontSize: number;
	readonly retooterFontSize: number;
	readonly trendingObjFontSize: number;
}

export interface ThemeConfig extends ThemeConfigBase {
	readonly favouritedTagColor: CSSProperties["color"];
	readonly feedBackgroundColor: CSSProperties["backgroundColor"];
	readonly feedBackgroundColorLite: CSSProperties["backgroundColor"];
	readonly trendingTagColor: CSSProperties["color"];
	readonly participatedTagColor: CSSProperties["color"];
	readonly followedUserColor: CSSProperties["color"];
}

// Conventional color palettes following popular design systems
const LIGHT_PALETTE: ColorPalette = {
	// Core colors
	background: "#ffffff",
	foreground: "#0f172a", // slate-900
	border: "#e2e8f0", // slate-200
	muted: "#f1f5f9", // slate-100
	mutedForeground: "#64748b", // slate-500

	// Semantic colors
	primary: "#3b82f6", // blue-500 (popular Twitter-like blue)
	primaryForeground: "#ffffff",
	secondary: "#8b5cf6", // violet-500
	secondaryForeground: "#ffffff",
	success: "#10b981", // emerald-500
	warning: "#f59e0b", // amber-500
	danger: "#ef4444", // red-500
	info: "#06b6d4", // cyan-500

	// Component-specific
	cardBackground: "#ffffff",
	inputBackground: "#f8fafc", // slate-50
	dmBackground: "#f0f9ff", // blue-50
};

const DARK_PALETTE: ColorPalette = {
	// Core colors
	background: "#0f172a", // slate-900
	foreground: "#f1f5f9", // slate-100
	border: "#334155", // slate-700
	muted: "#1e293b", // slate-800
	mutedForeground: "#94a3b8", // slate-400

	// Semantic colors
	primary: "#60a5fa", // blue-400 (lighter for dark mode)
	primaryForeground: "#0f172a",
	secondary: "#a78bfa", // violet-400
	secondaryForeground: "#0f172a",
	success: "#34d399", // emerald-400
	warning: "#fbbf24", // amber-400
	danger: "#f87171", // red-400
	info: "#22d3ee", // cyan-400

	// Component-specific
	cardBackground: "#1e293b", // slate-800
	inputBackground: "#0f172a", // slate-900
	dmBackground: "#1e3a8a", // blue-900
};

const THEME_BASE: ThemeConfigBase = {
	// Color palettes
	light: LIGHT_PALETTE,
	dark: DARK_PALETTE,

	// Feature-specific colors (using conventional colors)
	accordionOpenBlue: "#60a5fa", // blue-400
	followedTagColor: "#06b6d4", // cyan-500

	// Gradients (updated to conventional colors)
	favouritedTagGradient: [tinycolor("#fef3c7"), tinycolor("#fbbf24")], // amber gradient
	feedBackgrounGradient: [tinycolor("#f1f5f9"), tinycolor("#1e293b")], // slate gradient
	followedUserGradient: [tinycolor("#cffafe"), tinycolor("#06b6d4")], // cyan gradient
	participatedTagGradient: [tinycolor("#d1fae5"), tinycolor("#10b981")], // emerald gradient
	trendingTagGradient: [tinycolor("#fecaca"), tinycolor("#ef4444")], // red gradient

	// Fonts
	accountBioFontSize: 13, // Font size used in the account bio hover box
	defaultFontSize: DEFAULT_FONT_SIZE, // Emoji font size for account display names
	errorFontSize: 18, // Font size for error messages
	footerHashtagsFontSize: 13, // Font size for hashtags at bottom of a Post, under any images
	retooterFontSize: DEFAULT_FONT_SIZE, // Emoji font size for retooters' display names
	trendingObjFontSize: DEFAULT_FONT_SIZE + 1, // Emoji font size for trending objects
};

// Fill in a few extra colors that are the last color in the gradients as a convenience
export const THEME: ThemeConfig = {
	...THEME_BASE,
	favouritedTagColor: THEME_BASE.favouritedTagGradient
		.slice(-1)[0]
		.toHexString(),
	feedBackgroundColor: THEME_BASE.feedBackgrounGradient[1].toHexString(),
	feedBackgroundColorLite: THEME_BASE.feedBackgrounGradient[0].toHexString(),
	followedUserColor: THEME_BASE.followedUserGradient.slice(-1)[0].toHexString(),
	participatedTagColor: THEME_BASE.participatedTagGradient
		.slice(-1)[0]
		.toHexString(),
	trendingTagColor: THEME_BASE.trendingTagGradient.slice(-1)[0].toHexString(),
};

/**
 * Get the color palette for the specified theme mode
 * @param isDark - Whether dark mode is active
 * @returns ColorPalette for the current theme
 */
export function getThemePalette(isDark: boolean): ColorPalette {
	return isDark ? THEME.dark : THEME.light;
}

/** Wrap middleColors in endpoints and generate a tinygradient (see docs for details) */
export function buildGradient(
	endpoints: [tinycolor.Instance, tinycolor.Instance],
	middleColors?: tinycolor.Instance[],
): tinygradient.Instance {
	const gradientPoints = [endpoints[0], ...(middleColors || []), endpoints[1]];
	return tinygradient(...gradientPoints);
}
