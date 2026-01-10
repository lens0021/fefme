import { type RefObject, useEffect, useMemo, useState } from "react";

/**
 * Used to determine if an element is in the viewport. Currently sets the isBottom variable
 * which triggers the loading of infinite scroll content.
 * @param ref - Reference to the element to observe
 * @param rootMargin - Margin around the root (e.g., "200px" to trigger 200px before element enters viewport)
 */
export default function useOnScreen(
	ref: RefObject<HTMLElement>,
	rootMargin = "0px",
): boolean {
	const [isIntersecting, setIntersecting] = useState(false);

	const observer = useMemo(
		() =>
			new IntersectionObserver(
				([entry]) => setIntersecting(entry.isIntersecting),
				{ rootMargin },
			),
		[rootMargin],
	);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		observer.observe(element);
		return () => {
			observer.unobserve(element);
			// Disconnect observer when ref changes or component unmounts to prevent memory leaks
			observer.disconnect();
		};
	}, [observer, ref]);

	return isIntersecting;
}
