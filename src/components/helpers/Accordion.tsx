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
		const titleClassName = `font-bold text-[17px] mt-0 mb-[5px] ml-[5px] underline font-[Tahoma,Geneva,sans-serif] ${
			isActive ? "text-white" : "text-black"
		}`;
		const activeClassName = isActive ? "filterHeader--rounded" : "";

		return (
			<div className="border border-gray-200 rounded mb-2">
				<button
					type="button"
					onClick={toggleOpen}
					className="w-full text-left bg-gray-50 hover:bg-gray-100 transition-colors flex justify-between items-center p-0"
				>
					<span className={`${activeClassName} ${titleClassName}`}>
						{title}
					</span>
					<span className="text-gray-500">{isOpen ? "−" : "+"}</span>
				</button>

				{isOpen && (
					<div className="bg-[#b2bfd4]" style={bodyStyle}>
						{children}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="border-b border-gray-200" key={title}>
			<button
				type="button"
				onClick={toggleOpen}
				className="w-full text-left py-2 hover:bg-gray-50 transition-colors flex justify-between items-center"
			>
				<span className="cursor-pointer my-[-5px]">
					<span
						className={`filterHeader ${isActive ? "filterHeader--active" : ""}`}
						key={1}
					>
						{hasAnyCapitalLetters(title) ? title : capitalCase(title)}
					</span>

					{description && (
						<span
							className="text-[13px] font-medium text-black font-[Tahoma,Geneva,sans-serif]"
							key={2}
						>
							{"  "}({description})
						</span>
					)}
				</span>
				<span className="text-gray-500 px-2">{isOpen ? "−" : "+"}</span>
			</button>

			{isOpen && (
				<div className="bg-[#b2bfd4] pt-[7px]">
					{hasSwitches && (
						<div className="flex flex-row items-center justify-around font-bold text-base h-[25px] mb-[3px]">
							{switchbar}
						</div>
					)}

					{shouldWrapBody ? (
						<div className="rounded-[20px] bg-[#d3d3d3] pl-[25px] pr-[15px] pt-[10px] pb-[5px]">
							<div className="mb-1">
								<div className="mb-1">{children}</div>
							</div>
						</div>
					) : (
						children
					)}

					{footerSwitches && (
						<div className="flex flex-row items-center justify-around font-bold text-base h-[25px] mt-[7px] mb-[-10px]">
							{footerSwitches}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
