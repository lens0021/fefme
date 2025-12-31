/*
 * A reusable confirmation dialog.
 */
import { ConfirmDialog, confirmable, createConfirmation } from "react-confirm";


interface ConfirmationProps {
	okLabel?: string;
	cancelLabel?: string;
	title?: string;
	confirmation: string;
	show: boolean;
	proceed: (shouldProceed: boolean) => any; // called when ok button is clicked.
	enableEscape?: boolean;
}

const Confirmation = (props: ConfirmationProps) => {
	const {
		okLabel = "OK",
		cancelLabel = "Cancel",
		title = "Confirmation",
		confirmation,
		show,
		proceed,
		enableEscape = true,
	} = props;

	if (!show) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
			onClick={enableEscape ? () => proceed(false) : undefined}
		>
			<div
				className="bg-white text-black rounded-lg shadow-lg max-w-md w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="p-4 border-b">
					<h3 className="text-lg font-semibold">{title}</h3>
				</div>

				<div className="p-4">{confirmation}</div>

				<div className="p-4 border-t flex gap-2 justify-end">
					<button
						onClick={() => proceed(false)}
						className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
					>
						{cancelLabel}
					</button>

					<button
						onClick={() => proceed(true)}
						className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
					>
						{okLabel}
					</button>
				</div>
			</div>
		</div>
	);
};

export function confirm(
	confirmation: string,
	okLabel: string = "OK",
	cancelLabel: string = "Cancel",
	options: any = {},
) {
	return createConfirmation(confirmable(Confirmation))({
		confirmation,
		okLabel,
		cancelLabel,
		...options,
	});
}
