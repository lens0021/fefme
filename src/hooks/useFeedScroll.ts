import { debounce } from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

	const debouncedSetIsLoadingFalse = useMemo(
		() => debounce(() => setIsLoadingMorePosts(false), 250),
		[],
	);

	const debouncedShowMorePosts = useMemo(
		() =>
			debounce((visibleCount: number, currentNumDisplayedPosts: number) => {
				if (currentNumDisplayedPosts < visibleCount) {
					setNumDisplayedPosts((prev) => prev + numPostsToLoadOnScroll);
					debouncedSetIsLoadingFalse();
				} else {
					setIsLoadingMorePosts(false);
				}
			}, 150),
		[numPostsToLoadOnScroll, debouncedSetIsLoadingFalse],
	);

	const showMorePosts = useCallback(() => {
		if (isLoadingMorePosts) return;
		if (numDisplayedPosts < visibleCount) {
			setIsLoadingMorePosts(true);
			debouncedShowMorePosts(visibleCount, numDisplayedPosts);
		}
	}, [
		isLoadingMorePosts,
		numDisplayedPosts,
		visibleCount,
		debouncedShowMorePosts,
	]);

	useEffect(() => {
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
		numDisplayedPosts,
		visibleCount,
		showMorePosts,
	]);

	useEffect(() => {
		return () => {
			debouncedShowMorePosts.cancel();
			debouncedSetIsLoadingFalse.cancel();
		};
	}, [debouncedShowMorePosts, debouncedSetIsLoadingFalse]);

	return { isLoadingMorePosts, numDisplayedPosts, scrollPercentage };
}
