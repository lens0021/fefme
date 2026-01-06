import { useEffect, useRef, useState } from "react";

interface UseFeedScrollArgs {
	defaultNumDisplayedPosts: number;
	numPostsToLoadOnScroll: number;
	visibleCount: number;
}

export default function useFeedScroll({
	defaultNumDisplayedPosts,
	numPostsToLoadOnScroll,
	visibleCount,
}: UseFeedScrollArgs) {
	const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
	const [numDisplayedPosts, setNumDisplayedPosts] = useState(
		defaultNumDisplayedPosts,
	);
	const [scrollPercentage, setScrollPercentage] = useState(0);
	const loadingMoreTimeoutRef = useRef<number | null>(null);
	const loadingMoreApplyRef = useRef<number | null>(null);

	useEffect(() => {
		const showMorePosts = () => {
			if (isLoadingMorePosts) return;
			if (numDisplayedPosts < visibleCount) {
				setIsLoadingMorePosts(true);
				if (loadingMoreApplyRef.current) {
					window.clearTimeout(loadingMoreApplyRef.current);
				}
				loadingMoreApplyRef.current = window.setTimeout(() => {
					setNumDisplayedPosts((prev) => prev + numPostsToLoadOnScroll);
					if (loadingMoreTimeoutRef.current) {
						window.clearTimeout(loadingMoreTimeoutRef.current);
					}
					loadingMoreTimeoutRef.current = window.setTimeout(() => {
						setIsLoadingMorePosts(false);
					}, 250);
				}, 150);
			}
		};

		if (visibleCount && visibleCount < numDisplayedPosts) {
			setNumDisplayedPosts(visibleCount);
		}

		const handleScroll = () => {
			const scrollHeight = document.documentElement.scrollHeight;
			const scrollPosition =
				document.documentElement.scrollTop || window.scrollY;
			const viewportHeight = document.documentElement.clientHeight;
			const totalScrollableHeight = scrollHeight - viewportHeight;
			const preloadThresholdPx = Math.round(window.innerHeight * 0.3);
			const percentage = totalScrollableHeight
				? (scrollPosition / totalScrollableHeight) * 100
				: 0;
			setScrollPercentage(percentage);
			const nearBottom =
				totalScrollableHeight <= 0 ||
				scrollPosition >= totalScrollableHeight - preloadThresholdPx;
			if (nearBottom && visibleCount) {
				showMorePosts();
			}

			if (
				percentage <= 10 &&
				numDisplayedPosts > defaultNumDisplayedPosts * 3
			) {
				setNumDisplayedPosts(Math.floor(numDisplayedPosts * 0.8));
			}
		};

		window.addEventListener("scroll", handleScroll);
		handleScroll();
		return () => window.removeEventListener("scroll", handleScroll);
	}, [
		defaultNumDisplayedPosts,
		isLoadingMorePosts,
		numDisplayedPosts,
		numPostsToLoadOnScroll,
		visibleCount,
	]);

	useEffect(() => {
		return () => {
			if (loadingMoreTimeoutRef.current) {
				window.clearTimeout(loadingMoreTimeoutRef.current);
			}
			if (loadingMoreApplyRef.current) {
				window.clearTimeout(loadingMoreApplyRef.current);
			}
		};
	}, []);

	return { isLoadingMorePosts, numDisplayedPosts, scrollPercentage };
}
