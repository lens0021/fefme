import {
	type PropsWithChildren,
	type ReactNode,
	createContext,
	useContext,
	useState,
} from "react";

import { isString } from "lodash";
import { ErrorBoundary } from "react-error-boundary";
import { Logger } from "../../core/index";

import { config } from "../../config";
import { getLogger } from "../../helpers/log_helpers";
import { isEmptyStr } from "../../helpers/string_helpers";

const errorLogger = getLogger("ErrorHandler");

type ErrorLogProps = {
	args?: unknown[] | unknown;
	errorObj?: Error;
	logger?: Logger;
	msg: string;
	note?: string;
};

interface ErrorContextProps {
	logAndSetError?: (msg: Logger | Error | string, ...args: unknown[]) => void;
	logAndSetFormattedError?: (props: ErrorLogProps) => void;
	resetErrors?: () => void;
	setErrorMsg?: (error: string) => void;
}

const ErrorContext = createContext<ErrorContextProps>({});
export const useError = () => useContext(ErrorContext);

/**
 * Centralized error handling component that provides an ErrorBoundary and a context-based
 * error modal for displaying runtime errors to the user.
 */
export default function ErrorHandler(props: PropsWithChildren) {
	// If there's a non empty string in errorMsg, the error modal will be shown
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [errorNote, setErrorNote] = useState<string | null>(null);
	const [errorObj, setErrorObj] = useState<Error | null>(null);

	const resetErrors = () => {
		setErrorMsg(null);
		setErrorNote(null);
		setErrorObj(null);
	};

	const errorPage = ({ error, resetErrorBoundary }) => {
		errorLogger.error(`ErrorHandler: errorPage() called with error: ${error}`);

		return (
			<div
				className="bg-[color:var(--color-bg)] text-[color:var(--color-fg)] p-6 min-h-screen flex flex-col items-center justify-center text-center"
				style={{ fontSize: config.theme.errorFontSize }}
			>
				<h1 className="text-2xl font-bold mb-4">Something went wrong!</h1>

				<p
					className="bg-[color:var(--color-muted)] text-red-500 w-full max-w-2xl mt-6 p-4 rounded-lg border border-[color:var(--color-border)] font-mono break-words"
					style={{ fontSize: config.theme.errorFontSize }}
				>
					Error: {error.message}
				</p>

				<p className="mt-6 text-[color:var(--color-muted-fg)]">
					Report bugs:{" "}
					<a
						href={config.app.issuesUrl}
						className="text-[color:var(--color-primary)] hover:underline"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub Issues
					</a>
				</p>

				<div className="mt-8">
					<button
						type="button"
						className="bg-[color:var(--color-primary)] text-[color:var(--color-primary-fg)] text-base px-6 py-2.5 rounded-lg border-0 cursor-pointer transition-opacity hover:opacity-90 font-bold shadow-sm"
						onClick={() => {
							resetErrorBoundary();
							resetErrors();
						}}
					>
						Try again
					</button>
				</div>
			</div>
		);
	};

	// First argument can be the Logger you wish to use to write the error.
	// If first non-Logger arg is a string, that will be shown to the user.
	// The rest of the args (including any Errors) will be logged to the console.
	const logAndSetError = (
		error: Logger | Error | ReactNode,
		...args: unknown[]
	) => {
		let currentLogger = errorLogger;
		let firstArg: unknown = error;

		if (error instanceof Logger) {
			currentLogger = error;
			if (args.length === 0) {
				currentLogger.error(
					"logAndSetError called with a Logger but no message!",
				);
				return;
			}
			firstArg = args.shift();
		}

		// Find the first Error object in the arguments
		const errorArg =
			firstArg instanceof Error
				? firstArg
				: (args.find((arg) => arg instanceof Error) as Error | undefined);

		const formattedErrorMsg = currentLogger.error(
			String(firstArg),
			...(args as unknown[]),
		);

		setErrorObj(errorArg || null);
		setErrorMsg(typeof firstArg === "string" ? firstArg : formattedErrorMsg);
	};

	// Accepts structural error properties for more precise control over the error modal.
	const logAndSetFormattedError = (errorProps: ErrorLogProps) => {
		const { args, errorObj, logger, msg, note } = errorProps;
		const currentLogger = logger || errorLogger;

		setErrorObj(errorObj || null);
		setErrorNote(note || null);
		setErrorMsg(msg);

		const normalizedArgs = Array.isArray(args)
			? args
			: args !== undefined
				? [args]
				: [];
		const logArgs = errorObj ? [errorObj, ...normalizedArgs] : normalizedArgs;

		let logMsg = msg;
		if (note) logMsg += `\n(note: ${note})`;

		currentLogger.error(logMsg, ...logArgs);
	};

	const showModal = !!errorMsg || !!errorObj;

	return (
		<ErrorBoundary fallbackRender={errorPage}>
			{showModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1050] animate-in fade-in duration-200">
					<button
						type="button"
						aria-label="Close dialog"
						onClick={resetErrors}
						className="absolute inset-0 h-full w-full cursor-default"
					/>
					<div className="relative z-10 bg-[color:var(--color-card-bg)] text-[color:var(--color-fg)] rounded-xl max-w-[600px] w-[90%] max-h-[90vh] overflow-auto shadow-2xl border border-[color:var(--color-border)]">
						<div className="flex justify-between items-center px-6 py-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-muted)]">
							<h3 className="m-0 text-xl font-bold">Error</h3>
							<button
								type="button"
								onClick={resetErrors}
								className="bg-transparent border-0 text-2xl cursor-pointer text-[color:var(--color-muted-fg)] p-0 w-8 h-8 flex items-center justify-center hover:text-[color:var(--color-fg)] transition-colors"
								aria-label="Close"
							>
								×
							</button>
						</div>

						<div className="bg-[color:var(--color-bg)] flex flex-col py-6 px-8">
							{errorMsg &&
								(isString(errorMsg) ? (
									<p
										className="text-[color:var(--color-fg)] font-bold w-full mb-4 leading-snug"
										style={{ fontSize: config.theme.errorFontSize }}
									>
										{(errorMsg as string).length ? errorMsg : "No message."}
									</p>
								) : (
									errorMsg
								))}

							{errorNote && (
								<p className="text-[color:var(--color-muted-fg)] text-sm mb-4 italic">
									{errorNote}
								</p>
							)}

							{errorObj && (
								<div className="bg-[color:var(--color-muted)] font-mono rounded-lg mt-4 p-6 border border-[color:var(--color-border)] overflow-auto max-h-[40vh]">
									<p className="text-red-500 w-full text-sm whitespace-pre-wrap">
										{errorObj.toString()}
									</p>
								</div>
							)}
						</div>

						<div className="p-4 border-t border-[color:var(--color-border)] flex justify-end bg-[color:var(--color-muted)]">
							<button
								type="button"
								className="bg-[color:var(--color-primary)] text-[color:var(--color-primary-fg)] text-sm px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity shadow-sm"
								onClick={resetErrors}
							>
								Dismiss
							</button>
						</div>
					</div>
				</div>
			)}

			<ErrorContext.Provider
				value={{
					logAndSetFormattedError,
					logAndSetError,
					resetErrors,
					setErrorMsg,
				}}
			>
				{props.children}
			</ErrorContext.Provider>
		</ErrorBoundary>
	);
}
