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
	proceed: (shouldProceed: boolean) => void; // called when ok button is clicked.
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
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirmation-title"
		>
			<button
				type="button"
				aria-label="Close dialog"
				disabled={!enableEscape}
				onClick={enableEscape ? () => proceed(false) : undefined}
				className="absolute inset-0 h-full w-full cursor-default"
			/>
			<div className="relative z-10 bg-[color:var(--color-card-bg)] text-[color:var(--color-fg)] rounded-xl shadow-2xl max-w-md w-full mx-4 border border-[color:var(--color-border)] overflow-hidden animate-in fade-in zoom-in duration-200">
				<div className="p-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-muted)]">
					<h3 id="confirmation-title" className="text-lg font-bold">
						{title}
					</h3>
				</div>

				<div className="p-6 text-sm leading-relaxed">{confirmation}</div>

				<div className="p-4 border-t border-[color:var(--color-border)] flex gap-3 justify-end bg-[color:var(--color-muted)]">
					<button
						type="button"
						onClick={() => proceed(false)}
						className="px-4 py-2 border border-[color:var(--color-border)] rounded-lg hover:bg-[color:var(--color-light-shade)] transition-colors text-sm font-semibold"
					>
						{cancelLabel}
					</button>

					<button
						type="button"
						onClick={() => proceed(true)}
						autoFocus
						className="px-4 py-2 bg-[color:var(--color-primary)] text-[color:var(--color-primary-fg)] rounded-lg hover:opacity-90 transition-opacity text-sm font-bold shadow-sm"
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
	okLabel = "OK",
	cancelLabel = "Cancel",
	options: Record<string, unknown> = {},
) {
	return createConfirmation(confirmable(Confirmation))({
		confirmation,
		okLabel,
		cancelLabel,
		...options,
	} as ConfirmationProps);
}
