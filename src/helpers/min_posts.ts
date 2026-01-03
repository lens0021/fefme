import type { ObjList } from "../core/index";

import { config } from "../config";
import { getLogger } from "./log_helpers";

export const computeMinPostsDefaultValue = (
	objList: ObjList,
	title: string,
	idealNumOptions?: number,
): number => {
	const logger = getMinPostsLogger(title);
	const minPostsSliderCfg = config.filters.boolean.minPostsSlider;
	const resolvedIdealNumOptions =
		idealNumOptions ?? minPostsSliderCfg.idealNumOptions;
	logger.deep(
		`Computing default value for minPosts slider with ${objList.length} options`,
	);

	// Don't show the slider if there are too few options
	if (objList.objs.length < resolvedIdealNumOptions - 1) {
		return 0;
	}
	// It's "ideal" just in the sense that it has a value for numPosts that works well
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
		sliderDefault = idealOption.numPosts;
	}

	// TODO: if the objList gets refreshed while the filter is set to a high value, the slider will disappear :(
	logger.trace(
		`Adjusted minPosts slider default to ${sliderDefault} (${objList.length} tags)`,
	);
	return sliderDefault;
};

export const computeMinPostsMaxValue = (objList: ObjList, title: string) => {
	const logger = getMinPostsLogger(title);
	const minPostsSliderCfg = config.filters.boolean.minPostsSlider;

	if (objList.length === 0) {
		logger.info("No tags found in objList, using default maxValue of 5");
		return 5;
	}

	const topTags = objList.topObjs();
	const maxValueInTags = objList.maxNumPosts;
	const maxValueOptionIdx = Math.min(
		minPostsSliderCfg.minItems,
		objList.length - 1,
	);
	const maxValueOption = topTags[maxValueOptionIdx];
	let maxValue = maxValueOption?.numPosts;

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

const getMinPostsLogger = (title: string) => getLogger("MinPostsSlider", title);
