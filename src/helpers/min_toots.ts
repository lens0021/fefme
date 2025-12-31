import type { ObjList } from "../core/index";

import { config } from "../config";
import { getLogger } from "./log_helpers";

export const computeMinTootsDefaultValue = (
	objList: ObjList,
	title: string,
	idealNumOptions?: number,
): number => {
	const logger = getMinTootsLogger(title);
	const minTootsSliderCfg = config.filters.boolean.minTootsSlider;
	const resolvedIdealNumOptions =
		idealNumOptions ?? minTootsSliderCfg.idealNumOptions;
	logger.deep(
		`Computing default value for minPosts slider with ${objList.length} options`,
	);

	// Don't show the slider if there are too few options
	if (objList.objs.length < resolvedIdealNumOptions - 1) {
		return 0;
	}
	// It's "ideal" just in the sense that it has a value for numToots that works well
	const idealOption = objList.topObjs()[resolvedIdealNumOptions];
	let sliderDefault = 0;

	if (!idealOption) {
		logger.warn(
			"No ideal option found to help set minPosts slider default value",
		);
		sliderDefault =
			objList.objs.length > resolvedIdealNumOptions / 2
				? Math.floor(resolvedIdealNumOptions / 10)
				: 0;
	} else {
		sliderDefault = idealOption.numToots;
	}

	// TODO: if the objList gets refreshed while the filter is set to a high value, the slider will disappear :(
	logger.trace(
		`Adjusted minPosts slider default to ${sliderDefault} (${objList.length} tags)`,
	);
	return sliderDefault;
};

export const computeMinTootsMaxValue = (objList: ObjList, title: string) => {
	const logger = getMinTootsLogger(title);
	const minTootsSliderCfg = config.filters.boolean.minTootsSlider;

	if (objList.length === 0) {
		logger.info("No tags found in objList, using default maxValue of 5");
		return 5;
	}

	const topTags = objList.topObjs();
	const maxValueInTags = objList.maxNumToots;
	const maxValueOptionIdx = Math.min(
		minTootsSliderCfg.minItems,
		objList.length - 1,
	);
	const maxValueOption = topTags[maxValueOptionIdx];
	let maxValue = maxValueOption?.numToots;

	if (!maxValue) {
		const msg = `No max found at maxValueOptionIdx ${maxValueOptionIdx} in ${topTags.length} objs,`;
		logger.warn(
			`${msg} using maxValueInTags: ${maxValueInTags}. Obj:`,
			maxValueOption,
		);
		maxValue = maxValueInTags;
	}

	logger.trace(
		`Got maxValue ${maxValue} (maxValueInTags=${maxValueInTags}, maxValueOptionIdx=${maxValueOptionIdx})`,
	);
	return maxValue;
};

const getMinTootsLogger = (title: string) => getLogger("MinPostsSlider", title);
