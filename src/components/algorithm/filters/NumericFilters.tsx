/*
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fedivers.
 */
import { capitalCase } from "change-case";

import { config } from "../../../config";
import { SwitchType } from "../../../helpers/styles";
import { useAlgorithm } from "../../../hooks/useAlgorithm";
import Accordion from "../../helpers/Accordion";
import Slider from "./../Slider";
import HeaderSwitch from "./HeaderSwitch";

export default function NumericFilters(props: { isActive: boolean }) {
	const { isActive } = props;
	const { algorithm } = useAlgorithm();
	const numericFilters = Object.values(algorithm.filters.numericFilters);

	return (
		<Accordion
			description={config.filters.numeric.description}
			isActive={isActive}
			switchbar={[
				<HeaderSwitch
					isChecked={numericFilters.every((filter) => filter.invertSelection)}
					key={`${SwitchType.INVERT_SELECTION}--numericFilters`}
					label={SwitchType.INVERT_SELECTION}
					// TODO: this edits the filter object directly which isn't great
					onChange={(e) => {
						for (const filter of numericFilters) {
							filter.invertSelection = e.target.checked;
						}
					}}
					tooltipText={config.filters.numeric.invertSelectionTooltipTxt}
				/>,
			]}
			title={config.filters.numeric.title}
		>
			{Object.entries(algorithm.filters.numericFilters).map(
				([name, numericFilter]) => (
					<Slider
						description={numericFilter.description}
						key={numericFilter.propertyName}
						label={capitalCase(numericFilter.propertyName)}
						maxValue={config.filters.numeric.maxValue}
						minValue={0}
						// TODO: useCallback() could save a lot of re-renders here maybe...
						onChange={async (e) => {
							numericFilter.value = Number(e.target.value);
							algorithm.updateFilters(algorithm.filters);
						}}
						stepSize={1}
						value={numericFilter.value}
					/>
				),
			)}
		</Accordion>
	);
}
