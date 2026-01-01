/**
 * Application version (from package.json as SSOT)
 * Update package.json version with each commit
 */
import packageJson from "../package.json";

export const VERSION = packageJson.version;
