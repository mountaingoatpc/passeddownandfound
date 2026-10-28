import {
	type ChangeEvent,
	type FocusEvent,
	forwardRef,
	type InputHTMLAttributes,
} from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export interface CurrencyInputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {}

function formatToTwoDecimals(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed === "") return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed)) return null;
	return parsed.toFixed(2);
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
	({ className, placeholder = "0.00", onBlur, onChange, ...props }, ref) => {
		const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
			const formatted = formatToTwoDecimals(event.target.value);
			if (formatted !== null && formatted !== event.target.value && onChange) {
				const changeEvent = {
					...event,
					target: { ...event.target, value: formatted },
					currentTarget: { ...event.currentTarget, value: formatted },
				} as ChangeEvent<HTMLInputElement>;
				onChange(changeEvent);
			}
			onBlur?.(event);
		};

		return (
			<div className="relative">
				<span
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--muted-foreground))]"
					aria-hidden="true"
				>
					$
				</span>
				<Input
					ref={ref}
					type="number"
					inputMode="decimal"
					min="0"
					step="0.01"
					placeholder={placeholder}
					className={cn("pl-7", className)}
					{...props}
					onChange={onChange}
					onBlur={handleBlur}
				/>
			</div>
		);
	},
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
