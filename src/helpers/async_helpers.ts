/*
 * Helpers for async operations and loading state.
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
