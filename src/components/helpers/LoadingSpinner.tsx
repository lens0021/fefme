/*
 * Loading spinner.
 */
import React from "react";

import { READY_TO_LOAD_MSG } from "fedialgo";

interface LoadingSpinnerProps {
	isFullPage?: boolean;
	message?: string;
	style?: React.CSSProperties;
}

export default function LoadingSpinner(props: LoadingSpinnerProps) {
	const { isFullPage, message, style } = props;

	if (isFullPage) {
		return (
			<div
				className="flex flex-1 h-screen items-center justify-center"
				style={style}
			>
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
				<div className="ml-3">
					<p>{`${message || READY_TO_LOAD_MSG}...`}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-5 items-center mt-1.5" style={style}>
			<div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
			<div className="ml-3">
				<p>{`${message || READY_TO_LOAD_MSG}...`}</p>
			</div>
		</div>
	);
}
