/**
 * Helpers for async operations and error handling
 */
import type { Logger } from "fedialgo";

/**
 * Executes an async operation with automatic error handling
 * @param operation The async function to execute
 * @param logger The logger instance for logging errors
 * @param logAndSetError The error handler from useError hook
 * @returns The result of the operation, or undefined if an error occurred
 *
 * @example
 * const result = await withErrorHandling(
 *   async () => {
 *     logger.log("Updating weights...");
 *     return algorithm.updateWeights(newWeights);
 *   },
 *   logger,
 *   logAndSetError
 * );
 */
export async function withErrorHandling<T>(
	operation: () => Promise<T>,
	logger: Logger,
	logAndSetError: (logger: Logger, error: unknown) => void,
): Promise<T | undefined> {
	try {
		return await operation();
	} catch (error) {
		logAndSetError(logger, error);
		return undefined;
	}
}

/**
 * Executes an async operation with automatic error handling (non-async version)
 * @param operation The function to execute
 * @param logger The logger instance for logging errors
 * @param logAndSetError The error handler from useError hook
 * @returns The result of the operation, or undefined if an error occurred
 */
export function withErrorHandlingSync<T>(
	operation: () => T,
	logger: Logger,
	logAndSetError: (logger: Logger, error: unknown) => void,
): T | undefined {
	try {
		return operation();
	} catch (error) {
		logAndSetError(logger, error);
		return undefined;
	}
}

/**
 * Executes an async operation with loading state management
 * Sets loading to true before execution and false when complete
 * @param operation The async function to execute
 * @param setLoading The loading state setter function
 * @returns The result of the operation
 *
 * @example
 * const toots = await executeWithLoadingState(
 *   async () => toot.getConversation(),
 *   setIsLoadingThread
 * );
 * setThread(toots);
 */
export async function executeWithLoadingState<T>(
	operation: () => Promise<T>,
	setLoading: (loading: boolean) => void,
): Promise<T> {
	setLoading(true);
	try {
		return await operation();
	} finally {
		setLoading(false);
	}
}

/**
 * Executes an async operation with both loading state and error handling
 * @param operation The async function to execute
 * @param setLoading The loading state setter function
 * @param logger The logger instance for logging errors
 * @param logAndSetError The error handler from useError hook
 * @returns The result of the operation, or undefined if an error occurred
 *
 * @example
 * const result = await executeWithLoadingAndErrorHandling(
 *   async () => {
 *     logger.log("Fetching data...");
 *     return fetchData();
 *   },
 *   setIsLoading,
 *   logger,
 *   logAndSetError
 * );
 */
export async function executeWithLoadingAndErrorHandling<T>(
	operation: () => Promise<T>,
	setLoading: (loading: boolean) => void,
	logger: Logger,
	logAndSetError: (logger: Logger, error: unknown) => void,
): Promise<T | undefined> {
	setLoading(true);
	try {
		return await operation();
	} catch (error) {
		logAndSetError(logger, error);
		return undefined;
	} finally {
		setLoading(false);
	}
}
