import React, {
	type CSSProperties,
	type PropsWithChildren,
	type ReactElement,
	useState,
} from "react";

import { capitalCase } from "change-case";

import { hasAnyCapitalLetters } from "../../helpers/string_helpers";

type AccordionVariant = "top" | "sub";

interface AccordionProps extends PropsWithChildren {
	title: string;
	description?: string;
	isActive?: boolean;
	defaultOpen?: boolean;
	onExited?: () => void;
	switchbar?: ReactElement[];
	footerSwitches?: ReactElement[] | null;
	bodyStyle?: CSSProperties;
	variant?: AccordionVariant;
}

export default function Accordion(props: AccordionProps) {
	const {
		bodyStyle,
		defaultOpen,
		description,
		footerSwitches,
		isActive,
		onExited,
		switchbar,
		title,
		variant = "sub",
		children,
	} = props;
	const [isOpen, setIsOpen] = useState(!!defaultOpen);

	const toggleOpen = () => {
		if (isOpen && onExited) onExited();
		setIsOpen(!isOpen);
	};

	const hasSwitches = (switchbar?.length || 0) > 0;
	const shouldWrapBody = hasSwitches || footerSwitches?.length;

	if (variant === "top") {
		const titleClassName = "font-semibold text-sm";
		const activeClassName = isActive
			? "text-[color:var(--color-primary)]"
			: "text-[color:var(--color-fg)]";

		return (
			<div className="border border-[color:var(--color-border)] rounded-lg mb-2 bg-[color:var(--color-card-bg)]">
				<button
					type="button"
					onClick={toggleOpen}
					className="w-full text-left bg-[color:var(--color-muted)] hover:bg-[color:var(--color-light-shade)] transition-colors flex justify-between items-center px-3 py-2"
				>
					<span className={`${activeClassName} ${titleClassName}`}>
						{title}
					</span>
					<span className="text-[color:var(--color-muted-fg)]">
						{isOpen ? "−" : "+"}
					</span>
				</button>

				{isOpen && (
					<div className="bg-[color:var(--color-muted)]" style={bodyStyle}>
						{children}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="border-b border-[color:var(--color-border)]" key={title}>
			<button
				type="button"
				onClick={toggleOpen}
				className="w-full text-left py-2 hover:bg-[color:var(--color-light-shade)] transition-colors flex justify-between items-center"
			>
				<span className="cursor-pointer my-[-5px]">
					<span
						className={`text-sm font-semibold ${
							isActive
								? "text-[color:var(--color-primary)]"
								: "text-[color:var(--color-fg)]"
						}`}
						key={1}
					>
						{hasAnyCapitalLetters(title) ? title : capitalCase(title)}
					</span>

					{description && (
						<span
							className="text-xs font-medium text-[color:var(--color-muted-fg)]"
							key={2}
						>
							{"  "}({description})
						</span>
					)}
				</span>
				<span className="text-[color:var(--color-muted-fg)] px-2">
					{isOpen ? "−" : "+"}
				</span>
			</button>

			{isOpen && (
				<div className="bg-[color:var(--color-muted)] pt-2">
					{hasSwitches && (
						<div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs font-semibold">
							{switchbar}
						</div>
					)}

					{shouldWrapBody ? (
						<div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card-bg)] px-4 py-3">
							{children}
						</div>
					) : (
						children
					)}

					{footerSwitches && (
						<div className="flex flex-wrap items-center gap-2 px-3 pb-3 text-xs font-semibold">
							{footerSwitches}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
