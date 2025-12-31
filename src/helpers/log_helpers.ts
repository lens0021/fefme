/*
 * Logging helpers.
 */
import TheAlgorithm, { Logger } from "../core/index";

import {
	browserCountry,
	browserLanguage,
	browserLocale,
} from "./string_helpers";

export const LOG_PREFIX = "DEMO APP";

// Make a Logger instance with a LOG_PREFIX
export const getLogger = (...args: string[]) => new Logger(LOG_PREFIX, ...args);
export const appLogger = getLogger();

// Log the browser's locale information to the console
export const logLocaleInfo = (): void => {
	const env = import.meta.env;
	const msg = [
		`navigator.locale="${browserLocale()}"`,
		`language="${browserLanguage()}"`,
		`country="${browserCountry()}"`,
		`import.meta.env.MODE="${env.MODE}"`,
		`import.meta.env.VITE_FEDIALGO_DEBUG="${env.VITE_FEDIALGO_DEBUG}"`,
		`TheAlgorithm.isDebugMode="${TheAlgorithm.isDebugMode}"`,
		`import.meta.env.VITE_FEDIALGO_VERSION="${env.VITE_FEDIALGO_VERSION}"`,
	];

	appLogger.log(`${msg.join(", ")}`);
};
