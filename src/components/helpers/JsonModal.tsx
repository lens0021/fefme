/*
 * Modal to display JSON data.
 * React Bootstrap Modal: https://getbootstrap.com/docs/5.0/components/modal/
 */
import React, { type CSSProperties, type ReactNode } from "react";

import ReactJsonView from "@microlink/react-json-view";

import type { ModalProps } from "../../types";

type ReactJsonViewProps = typeof ReactJsonView.defaultProps;

// Props documentation: https://github.com/microlinkhq/react-json-view?tab=readme-ov-file#api
const DEFAULT_JSON_VIEW_PROPS: ReactJsonViewProps = {
	collapsed: 1,
	displayArrayKey: false,
	displayDataTypes: false,
	displayObjectSize: false,
	enableClipboard: false,
	quotesOnKeys: false,
	sortKeys: true,
	style: { padding: "20px" },
	theme: "rjv-default", // "apathy:inverted",
};

interface JsonModalProps extends ModalProps {
	infoTxt?: ReactNode;
	json: object;
	jsonViewProps?: ReactJsonViewProps;
}

export default function JsonModal(props: JsonModalProps) {
	let {
		dialogClassName,
		infoTxt,
		json,
		jsonViewProps,
		show,
		setShow,
		subtitle,
		title,
	} = props;
	jsonViewProps = { ...DEFAULT_JSON_VIEW_PROPS, ...(jsonViewProps || {}) };
	jsonViewProps.style = { ...jsonViewStyle, ...(jsonViewProps.style || {}) };
	json ??= {};

	if (!show) return null;

	const sizeClass =
		dialogClassName === "modal-xl"
			? "max-w-6xl"
			: dialogClassName === "modal-lg"
				? "max-w-4xl"
				: "max-w-2xl";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<button
				type="button"
				aria-label="Close dialog"
				onClick={() => setShow(false)}
				className="absolute inset-0 h-full w-full cursor-default"
			/>
			<div
				className={`relative z-10 bg-white rounded-lg shadow-lg ${sizeClass} w-full mx-4 max-h-[90vh] overflow-y-auto`}
			>
				<div className="p-4 border-b flex justify-between items-center text-black">
					<h3 className="text-lg font-semibold">{title}</h3>
					<button
						type="button"
						onClick={() => setShow(false)}
						className="text-2xl leading-none hover:text-gray-600"
						aria-label="Close"
					>
						×
					</button>
				</div>

				<div className="p-4">
					{(subtitle || infoTxt) && (
						<div className="text-black mb-[5px]">
							{subtitle && (
								<div className="text-[14px] font-bold font-[Tahoma,Geneva,sans-serif] mb-[5px]">
									{subtitle}
								</div>
							)}
							{infoTxt && <div>{infoTxt}</div>}
						</div>
					)}

					<ReactJsonView {...jsonViewProps} src={json || {}} />
				</div>
			</div>
		</div>
	);
}

const jsonViewStyle: CSSProperties = {
	borderRadius: 15,
	padding: "20px",
};
