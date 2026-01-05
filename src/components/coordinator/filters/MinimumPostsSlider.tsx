import type React from "react";
import { Tooltip } from "react-tooltip";

interface MinimumPostsSliderProps {
	filterPropertyName: string;
	minPosts: number;
	minPostsMaxValue: number;
	onMinPostsChange: (value: number) => void;
	tooltipDelay: number;
}

export default function MinimumPostsSlider({
	filterPropertyName,
	minPosts,
	minPostsMaxValue,
	onMinPostsChange,
	tooltipDelay,
}: MinimumPostsSliderProps): React.ReactElement {
	const tooltipAnchor = `${filterPropertyName}-min-posts-slider-tooltip`;
	const pluralizedPanelTitle = `${filterPropertyName}s`.toLowerCase();

	return (
		<div key={`${filterPropertyName}-minPostsSlider`} className="w-full">
			<Tooltip
				className="font-normal z-[2000] max-w-[calc(100vw-2rem)] whitespace-normal break-words"
				delayShow={tooltipDelay}
				id={tooltipAnchor}
				place="bottom"
			/>

			<button
				type="button"
				className="text-left w-full"
				data-tooltip-id={tooltipAnchor}
				data-tooltip-content={`Hide ${pluralizedPanelTitle} with less than ${minPosts} posts`}
			>
				<div className="me-2">
					<div className="flex flex-col gap-2 text-xs">
						<div className="w-full">
							<input
								type="range"
								className="custom-slider w-full"
								min={1}
								max={minPostsMaxValue}
								onChange={(e) =>
									onMinPostsChange(Number.parseInt(e.target.value, 10))
								}
								step={1}
								value={minPosts}
							/>
						</div>

						<div className="flex items-center justify-between text-xs">
							<span>
								<span className="font-bold mr-1">Minimum</span>
							</span>
						</div>
					</div>
				</div>
			</button>
		</div>
	);
}
