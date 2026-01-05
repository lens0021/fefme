/*
 * Component for setting the user's preferred weightings of various post properties.
 * Things like how much to prefer people you favorite a lot or how much to posts that
 * are trending in the Fediverse.
 */
import { useCallback } from "react";
import { capitalCase } from "change-case";

import { config } from "../../../config";
import { useCoordinator } from "../../../hooks/useCoordinator";
import Accordion from "../../helpers/Accordion";
import Slider from "./../Slider";

export default function NumericFilters(props: { isActive: boolean }) {
	const { isActive } = props;
	const { algorithm, triggerFilterUpdate } = useCoordinator();

	const createHandleChange = useCallback(
		(numericFilter: (typeof algorithm.filters.numericFilters)[keyof typeof algorithm.filters.numericFilters]) =>
			async (e: React.ChangeEvent<HTMLInputElement>) => {
				numericFilter.value = Number(e.target.value);
				await triggerFilterUpdate?.(algorithm.filters);
			},
		[algorithm.filters, triggerFilterUpdate],
	);

	return (
		<Accordion
			description={config.filters.numeric.description}
			isActive={isActive}
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
						onChange={createHandleChange(numericFilter)}
						stepSize={1}
						value={numericFilter.value}
					/>
				),
			)}
		</Accordion>
	);
}
