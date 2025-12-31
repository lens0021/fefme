/*
 * Modal to display JSON data.
 * React Bootstrap Modal: https://getbootstrap.com/docs/5.0/components/modal/
 */
import React, { CSSProperties } from "react";

import { DataKey } from "recharts/types/util/types";
import {
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { MinMaxAvgScore, ScoreName, ScoreStats } from "fedialgo";

import LabeledDropdownButton from "../helpers/LabeledDropdownButton";
import { config } from "../../config";
import { formatScore } from "../../helpers/number_helpers";
import { ModalProps } from "../../types";
import {
	RECHARTS_COLORS,
	blackBackground,
	blackFont,
	roundedCorners,
} from "../../helpers/style_helpers";
import { useAlgorithm } from "../../hooks/useAlgorithm";

const SCORE_TYPES: (keyof ScoreStats)[] = ["raw", "weighted"];
const VALUE_TYPES: (keyof MinMaxAvgScore)[] = [
	"average",
	"averageFinalScore",
	"min",
	"max",
];

export default function StatsModal(props: ModalProps) {
	let { dialogClassName, show, setShow, title } = props;
	const { algorithm } = useAlgorithm();
	if (!algorithm) return <> </>;

	const data = show
		? algorithm.getRechartsStatsData(config.stats.numPercentiles)
		: [];
	const [hiddenLines, setHiddenLines] = React.useState<
		Array<DataKey<string | number>>
	>([]);
	const [scoreType, setScoreType] =
		React.useState<keyof ScoreStats>("weighted");
	const [valueType, setValueType] =
		React.useState<keyof MinMaxAvgScore>("average");

	const handleLegendClick = (dataKey: DataKey<string | number>) => {
		if (hiddenLines.includes(dataKey)) {
			setHiddenLines(hiddenLines.filter((el) => el !== dataKey));
		} else {
			setHiddenLines((prev) => [...prev, dataKey]);
		}
	};

	if (!show) return null;

	const sizeClass = dialogClassName === "modal-xl" ? "max-w-6xl" : "max-w-2xl";

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
			onClick={() => setShow(false)}
		>
			<div
				className={`bg-white rounded-lg shadow-lg ${sizeClass} w-full mx-4 max-h-[90vh] overflow-y-auto`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="p-4 border-b flex justify-between items-center" style={blackFont}>
					<h3 className="text-lg font-semibold">{title}</h3>
					<button
						onClick={() => setShow(false)}
						className="text-2xl leading-none hover:text-gray-600"
						aria-label="Close"
					>
						×
					</button>
				</div>

				<div className="p-4">
				<LabeledDropdownButton
					initialLabel={"Raw or Weighted"}
					onClick={(value) => setScoreType(value as keyof ScoreStats)}
					options={SCORE_TYPES}
					style={buttonStyle}
				/>

				<LabeledDropdownButton
					initialLabel={"Value Type"}
					onClick={(value) => setValueType(value as keyof MinMaxAvgScore)}
					options={VALUE_TYPES}
					style={buttonStyle}
				/>

				<ResponsiveContainer height={600} width="100%">
					<LineChart
						data={data}
						height={900}
						width={1000}
						margin={{
							top: 5,
							right: 30,
							left: 20,
							bottom: 5,
						}}
						style={charStyle}
					>
						{/* <CartesianGrid strokeDasharray="3 3" /> */}
						<XAxis dataKey="segment" />
						<YAxis />

						<Tooltip
							formatter={(value, name) => [
								formatScore(Number(value)),
								(name as string).split("_")[0],
							]}
							contentStyle={blackBackground}
							labelStyle={tooltipStyle}
						/>

						<Legend
							formatter={(value, entry, i) => value.split("_")[0]}
							onClick={(props) => handleLegendClick(props.dataKey)}
						/>

						{Object.values(ScoreName).map((scoreName, i) => {
							const key = `${scoreName}_${scoreType}_${valueType}`;

							return (
								<Line
									animationDuration={config.stats.animationDuration}
									dataKey={key}
									hide={hiddenLines.includes(key)}
									key={key}
									legendType="line"
									stroke={RECHARTS_COLORS[i]}
									strokeWidth={2}
								/>
							);
						})}
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
		</div>
	);
}

const buttonStyle: CSSProperties = {
	marginBottom: "5px",
	marginRight: "10px",
	marginTop: "-10px", // TODO: this sucks
};

const charStyle: CSSProperties = {
	...roundedCorners,
	backgroundColor: config.theme.feedBackgroundColor,
};

const tooltipStyle: CSSProperties = {
	fontSize: 20,
	fontWeight: "bold",
};
