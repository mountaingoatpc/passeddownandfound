import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export interface CurrencyInputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
	({ className, placeholder = "0.00", ...props }, ref) => (
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
			/>
		</div>
	),
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
