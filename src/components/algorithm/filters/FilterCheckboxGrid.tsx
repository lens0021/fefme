/*
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fedivers.
 */
import { useMemo } from "react";

import {
	type BooleanFilter,
	BooleanFilterName,
	type BooleanFilterOption,
	FILTER_OPTION_DATA_SOURCES,
	type FilterOptionDataSource,
	ScoreName,
	TagTootsCategory,
	TypeFilterName,
} from "fedialgo";
import { isEmpty, isFinite as isFiniteNumber } from "lodash";

import { config } from "../../../config";
import { getLogger } from "../../../helpers/log_helpers";
import { gridify } from "../../../helpers/ui";
import { buildGradient } from "../../../helpers/styles";
import type {
	CheckboxGradientTooltipConfig,
	CheckboxTooltipConfig,
} from "../../../helpers/ui";
import { useAlgorithm } from "../../../hooks/useAlgorithm";
import Checkbox, {
	FILTER_TOOLTIP_ANCHOR,
	HIGHLIGHTED_TOOLTIP_ANCHOR,
} from "../../helpers/Checkbox";
import type {
	HeaderSwitchState,
	TagHighlightSwitchState,
} from "../BooleanFilterAccordionSection";

type DataSourceGradients = Record<
	FilterOptionDataSource,
	CheckboxGradientTooltipConfig
>;

interface FilterCheckboxGridProps extends HeaderSwitchState {
	filter: BooleanFilter;
	minToots?: number;
	tagSwitchState?: TagHighlightSwitchState;
}

// TODO: maybe rename this BooleanFilterCheckboxGrid?
export default function FilterCheckboxGrid(props: FilterCheckboxGridProps) {
	const { filter, highlightsOnly, minToots, sortByCount, tagSwitchState } =
		props;
	const {
		algorithm,
		allowMultiSelect,
		alwaysShowFollowed,
		selfTypeFilterEnabled,
		setSelfTypeFilterEnabled,
		showFilterHighlights,
	} = useAlgorithm();
	const logger = useMemo(
		() => getLogger("FilterCheckboxGrid", filter.propertyName),
		[filter.propertyName],
	);

	const optionsFormatCfg =
		config.filters.boolean.optionsFormatting[filter.propertyName];
	const tooltipConfig = optionsFormatCfg?.tooltips || {};
	const isTagFilter = filter.propertyName === BooleanFilterName.HASHTAG;
	const isTypeFilter = filter.propertyName === BooleanFilterName.TYPE;
	const isUserFilter = filter.propertyName === BooleanFilterName.USER;

	// Build a dict from FilterOptionDataSource to tooltip objs with the color (or gradient) + base text
	const tooltipGradients: DataSourceGradients = useMemo(
		() =>
			FILTER_OPTION_DATA_SOURCES.reduce((gradients, dataSource) => {
				const baseTooltipCfg = tooltipConfig[dataSource];
				const gradientCfg = baseTooltipCfg?.highlight?.gradient;
				if (!gradientCfg) return gradients; // Skip if there's no configured gradient

				// Ensure at least 2 for the gradient
				const maxValue = Math.max(filter.options.maxValue(dataSource) || 0, 2);
				let colorGradient = buildGradient(gradientCfg.endpoints);

				// Adjust the color gradient so there's more color variation in the low/middle range
				if (
					gradientCfg.adjustment &&
					filter.options.length > gradientCfg.adjustment.minTagsToAdjust
				) {
					try {
						const highPctiles = gradientCfg.adjustment.adjustPctiles.map((p) =>
							Math.floor(maxValue * p),
						);
						const middleColors = highPctiles
							.map((n) => colorGradient[n])
							.filter(Boolean);
						colorGradient = buildGradient(gradientCfg.endpoints, middleColors);
						logger.deep(
							`Adjusted ${dataSource} gradient, maxValue=${maxValue}`,
						);
					} catch (err) {
						logger.error(
							`Failed to adjust ${dataSource} gradient w/maxValue=${maxValue}):`,
							err,
						);
					}
				}

				// Add the colors array to the baseTooltipCfg
				// gradients[dataSource] = {...baseTooltipCfg, colors: colorGradient.hsv(maxValue, false)};
				gradients[dataSource] = {
					...baseTooltipCfg,
					colors: colorGradient.rgb(maxValue),
				};
				logger.deep(`Rebuilt gradient, maxValue=${maxValue}`);
				return gradients;
			}, {} as DataSourceGradients),
		[filter.options, logger, tooltipConfig],
	);

	/**
	 * Get the color & text for the tooltip based on the number stored in the option prop w/name same
	 * as dataSource param. Returns null if the option doesn't have a number for that dataSource.
	 * @param {BooleanFilterOption} option - The filter option to get the tooltip for
	 * @param {FilterOptionDataSource} dataSource - The property of the option to use for the gradient value
	 * @param {boolean} [boostValue] If true and the option is followed, boost the value half way up the gradient
	 * @returns {CheckboxTooltipConfig | undefined} A CheckboxTooltipConfig (or undefined if none should be shown)
	 */
	const getGradientTooltip = (
		option: BooleanFilterOption,
		dataSource: FilterOptionDataSource,
		boostValue?: boolean,
	): CheckboxTooltipConfig | undefined => {
		const gradientCfg = tooltipGradients[dataSource];
		const optionGradientValue = option[dataSource]; // The value driving the gradient, e.g. num favourites
		if (!isFiniteNumber(optionGradientValue)) return undefined;
		if (!gradientCfg)
			logger.logAndThrowError(`No gradientCfg found for "${dataSource}"!`);

		// Boost the value half way up the gradient if requested
		const numColors = gradientCfg.colors.length;
		const boostAmount = boostValue ? Math.floor(numColors / 2) : 0;
		const boostedValue = Math.min(
			optionGradientValue + boostAmount,
			gradientCfg.colors.length - 1,
		); // Ensure we don't go above the max index
		let color = gradientCfg.colors[Math.max(boostedValue, 1) - 1]; // Math.max() to avoid negative indices on 0

		if (!color) {
			const warningMsg =
				`No color found for option (dataSource="${dataSource}", ` +
				`gradient color array has ${gradientCfg.colors?.length} elements):`;
			logger.warn(warningMsg, option);
			color = gradientCfg.highlight.gradient.endpoints[1]; // Use the top color
		}

		return {
			highlight: { color: color.toHexString() },
			text: gradientCfg.highlight.gradient.textWithSuffix(
				gradientCfg.text,
				optionGradientValue,
			),
		};
	};

	/**
	 * Return a finalized CheckboxTooltipConfig with full text and color for the option
	 * if showFilterHighlights is enabled and the option has a non-zero value for the dataSource.
	 * @param {BooleanFilterOption} option The filter option to get the tooltip for
	 * @returns {CheckboxTooltipConfig} A CheckboxTooltipConfig or undefined if no tooltip should be shown
	 */
	const findTooltip = (
		option: BooleanFilterOption,
	): CheckboxTooltipConfig | undefined => {
		if (!showFilterHighlights) return undefined;
		let tooltip: CheckboxTooltipConfig | undefined;

		if (isTagFilter) {
			// Fall through to the first gradient color we have a non-zero value for in the option
			tooltip = option.isFollowed
				? tooltipConfig[TypeFilterName.FOLLOWED_HASHTAGS]
				: undefined;

			const tagSources = Object.values(TagTootsCategory).reverse();
			for (const dataSource of tagSources) {
				tooltip ||=
					tagSwitchState?.[dataSource] &&
					getGradientTooltip(option, dataSource);
			}
		} else if (isUserFilter) {
			tooltip = getGradientTooltip(
				option,
				ScoreName.FAVOURITED_ACCOUNTS,
				option.isFollowed,
			);

			// Adjust tooltip text for followed accounts
			if (tooltip && option.isFollowed) {
				const userTooltipCfg = tooltipConfig[ScoreName.FAVOURITED_ACCOUNTS];
				tooltip.text =
					userTooltipCfg.text +
					(isEmpty(tooltip.text) ? "" : ` (${tooltip.text.toLowerCase()})`);
			}
		} else if (filter.propertyName === BooleanFilterName.LANGUAGE) {
			tooltip = getGradientTooltip(option, filter.propertyName);
		}

		return tooltip;
	};

	const optionGrid = (() => {
		logger.deep(
			`Rebuilding optionGrid for ${filter.options.length} options (${filter.selectedOptions.length} selected)`,
		);

		let options = sortByCount
			? filter.optionsSortedByValue(minToots, alwaysShowFollowed)
			: filter.optionsSortedByName(minToots, alwaysShowFollowed);

		if (highlightsOnly && showFilterHighlights) {
			options = options.filter((option) => !!findTooltip(option));
		}

		const optionCheckboxes = options.objs.map((option) => {
			const label = option.displayName || option.name;

			const labelExtra = option?.numToots?.toLocaleString();

			return (
				<Checkbox
					isChecked={filter.isOptionEnabled(option.name)}
					key={option.name}
					label={
						optionsFormatCfg?.formatLabel
							? optionsFormatCfg?.formatLabel(label)
							: label
					}
					labelExtra={labelExtra}
					onChange={(e) => {
						if (
							isTypeFilter &&
							!allowMultiSelect &&
							e.target.checked &&
							selfTypeFilterEnabled
						) {
							setSelfTypeFilterEnabled?.(false);
						}
						filter.updateOption(option.name, e.target.checked, allowMultiSelect);
					}}
					tooltip={findTooltip(option)}
					tooltipAnchor={FILTER_TOOLTIP_ANCHOR}
					highlightedTooltipAnchor={HIGHLIGHTED_TOOLTIP_ANCHOR}
					updateFilters={true}
					url={isTagFilter && algorithm.tagUrl(option.name)} // TODO: could add links for users too
				/>
			);
		});

		if (isTypeFilter && setSelfTypeFilterEnabled) {
			optionCheckboxes.unshift(
				<Checkbox
					isChecked={selfTypeFilterEnabled ?? false}
					key="type-filter-self"
					label="Me"
					onChange={(e) => {
						if (e.target.checked && !allowMultiSelect) {
							filter.selectedOptions = [];
							algorithm.updateFilters(algorithm.filters);
						}
						setSelfTypeFilterEnabled(e.target.checked);
					}}
					updateFilters={false}
				/>,
			);
		}

		return gridify(optionCheckboxes);
	})();

	return optionGrid;
}
