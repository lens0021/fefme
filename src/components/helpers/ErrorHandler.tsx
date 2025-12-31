import {
	type PropsWithChildren,
	type ReactNode,
	createContext,
	useContext,
	useState,
} from "react";

import { Logger } from "../../core/index";
import { isString } from "lodash";
import { ErrorBoundary } from "react-error-boundary";

import { config } from "../../config";
import { getLogger } from "../../helpers/log_helpers";
import { extractText } from "../../helpers/ui";
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
 * Generic component to display a set of filter options with a switchbar at the top.
 * Note this doesn't handle errors from event handlers: https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react
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

	// TODO: this error page rendering is a bit unresolved / not 100% correct, but it works for now.
	const errorPage = ({ error, resetErrorBoundary }) => {
		errorLogger.error(`ErrorHandler: errorPage() called with error: ${error}`);

		return (
			<div
				className="bg-black text-white p-6"
				style={{ fontSize: config.theme.errorFontSize }}
			>
				<h1>Something went wrong!</h1>

				<p
					className="bg-black text-red-500 w-full mt-6"
					style={{ fontSize: config.theme.errorFontSize + 1 }}
				>
					Error: {error.message}
				</p>

				<p>
					<>
						Report bugs:{" "}
						<a
							href={config.app.issuesUrl}
							className="text-gray-300 no-underline"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub Issues
						</a>
					</>
				</p>

				<div className="mt-6">
					<button
						type="button"
						className="text-white text-base px-5 py-2.5 rounded-md border-0 cursor-pointer transition-colors"
						style={{ backgroundColor: config.theme.light.primary }}
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

	// First argument can be the Logger you wish to use to write the error
	// If first non Logger arg is a string, that will be put in setError()
	// for the user to see and the actual rest of the args (including any Errors) will be logged.
	const logAndSetError = (
		error: Logger | Error | ReactNode,
		...args: unknown[]
	) => {
		let firstArg: unknown = error;
		let logger = errorLogger;

		// If the first argument is a Logger use it to log the error
		if (error instanceof Logger) {
			logger = error;

			if (!args.length) {
				logger.error("logAndSetError called with a Logger but no message!");
				return;
			}

			firstArg = args.shift();
		}

		// Dig out the first Error argument from the args list (if any)
		const errorArg =
			firstArg instanceof Error
				? firstArg
				: args.find((arg): arg is Error => arg instanceof Error);
		const formattedErrorMsg = logger.error(
			String(firstArg),
			...(args as unknown[]),
		);

		if (errorArg) {
			setErrorObj(errorArg);
			if (typeof firstArg === "string") {
				setErrorMsg(firstArg);
			} else {
				setErrorMsg(formattedErrorMsg);
			}
		} else {
			setErrorMsg(formattedErrorMsg);
		}
	};

	// Accepts the 3 parts of an error popup as separate props (see ErrorLogProps above).
	// args props is not shown to the user but they are passed through to the logger.
	const logAndSetFormattedError = (errorProps: ErrorLogProps) => {
		const { args, errorObj, logger, msg, note } = errorProps;
		setErrorObj(errorObj || null);
		setErrorNote(note || null);
		setErrorMsg(msg);
		let normalizedArgs: unknown[] = [];
		if (Array.isArray(args)) {
			normalizedArgs = args;
		} else if (args !== undefined) {
			normalizedArgs = [args];
		}

		// Handle writing to console log, which means putting errorObj first for Logger
		normalizedArgs = errorObj ? [errorObj, ...normalizedArgs] : normalizedArgs;
		let logMsg = isString(msg) ? msg : (extractText(msg) as string[]).join(" "); // TODO: why use extractText() here?
		logMsg += isEmptyStr(note) ? "" : `\n(note: ${note})`;
		(logger || errorLogger).error(logMsg, ...normalizedArgs);
	};

	const showModal = !!errorMsg || !!errorObj;

	return (
		<ErrorBoundary fallbackRender={errorPage}>
			{showModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1050]">
					<button
						type="button"
						aria-label="Close dialog"
						onClick={resetErrors}
						className="absolute inset-0 h-full w-full cursor-default"
					/>
					<div className="relative z-10 bg-white rounded-lg max-w-[600px] w-[90%] max-h-[90vh] overflow-auto shadow-md">
						<div className="flex justify-between items-center px-5 py-4 border-b border-gray-200">
							<h3 className="m-0 text-xl font-semibold">Error</h3>
							<button
								type="button"
								onClick={resetErrors}
								className="bg-transparent border-0 text-[28px] cursor-pointer text-gray-500 p-0 w-8 h-8 flex items-center justify-center"
								aria-label="Close"
							>
								×
							</button>
						</div>

						<div className="bg-pink-200 flex flex-col py-5 px-10">
							{errorMsg &&
								(isString(errorMsg) ? (
									<p
										className="text-black font-bold w-full mb-2.5"
										style={{ fontSize: config.theme.errorFontSize }}
									>
										{(errorMsg as string).length ? errorMsg : "No message."}
									</p>
								) : (
									errorMsg
								))}

							{errorNote && (
								<p
									className="text-black"
									style={{ fontSize: config.theme.errorFontSize - 4 }}
								>
									{errorNote}
								</p>
							)}

							{errorObj && (
								<div className="bg-black font-mono rounded-[10px] mt-[15px] min-h-[120px] p-[35px]">
									<p
										className="text-red-500 w-full"
										style={{ fontSize: config.theme.errorFontSize + 1 }}
									>
										{errorObj.toString()}
									</p>
								</div>
							)}
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
