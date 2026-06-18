import { cn } from "@/lib/cn";
import {
	CONDITION_TYPES,
	type ConditionType,
	PRE_OWNED_GRADES,
	type PreOwnedGrade,
	parseCondition,
	serializeCondition,
} from "@/lib/condition";

interface ConditionPickerProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	className?: string;
}

const selectClassName =
	"flex h-9 w-full rounded-[var(--radius)] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50";

export function ConditionPicker({
	value,
	onChange,
	disabled = false,
	className,
}: ConditionPickerProps) {
	const { type, grade } = parseCondition(value);

	const handleTypeChange = (nextType: ConditionType | "") => {
		if (nextType === "new") {
			onChange("new");
			return;
		}

		if (nextType === "pre-owned") {
			onChange("pre-owned");
			return;
		}

		onChange("");
	};

	const handleGradeChange = (nextGrade: PreOwnedGrade | "") => {
		onChange(serializeCondition("pre-owned", nextGrade));
	};

	return (
		<div className={cn("space-y-2", className)}>
			<select
				id="condition-type"
				value={type}
				onChange={(e) => handleTypeChange(e.target.value as ConditionType | "")}
				disabled={disabled}
				className={selectClassName}
			>
				<option value="">Select condition...</option>
				{CONDITION_TYPES.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>

			{type === "pre-owned" && (
				<select
					id="condition-grade"
					value={grade}
					onChange={(e) =>
						handleGradeChange(e.target.value as PreOwnedGrade | "")
					}
					disabled={disabled}
					className={selectClassName}
				>
					<option value="">Select grade...</option>
					{PRE_OWNED_GRADES.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			)}
		</div>
	);
}
