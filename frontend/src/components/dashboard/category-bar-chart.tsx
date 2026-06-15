import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format-currency";
import {
	type CategoryChartMetric,
	type CategoryMetricRow,
	getCategoryMetricValue,
} from "@/lib/inventory-metrics";

interface CategoryBarChartProps {
	data: CategoryMetricRow[];
	metric: CategoryChartMetric;
}

function getBarColor(metric: CategoryChartMetric, value: number): string {
	if (metric === "projected_profit") {
		return value >= 0
			? "bg-[hsl(var(--success))]"
			: "bg-[hsl(var(--destructive))]";
	}

	return "bg-[hsl(var(--primary))]";
}

function getBarLayout(
	value: number,
	maxValue: number,
	minValue: number,
): { leftPercent: number; widthPercent: number; zeroOffsetPercent: number } {
	const hasNegative = minValue < 0;
	const hasPositive = maxValue > 0;

	if (!hasNegative) {
		const scaleMax = maxValue || 1;
		return {
			leftPercent: 0,
			widthPercent: (value / scaleMax) * 100,
			zeroOffsetPercent: 0,
		};
	}

	if (!hasPositive) {
		const scaleMin = Math.abs(minValue) || 1;
		const widthPercent = (Math.abs(value) / scaleMin) * 100;
		return {
			leftPercent: 100 - widthPercent,
			widthPercent,
			zeroOffsetPercent: 100,
		};
	}

	const range = maxValue - minValue;
	const zeroOffsetPercent = (maxValue / range) * 100;
	const widthPercent = (Math.abs(value) / range) * 100;

	return {
		leftPercent:
			value >= 0 ? zeroOffsetPercent : zeroOffsetPercent - widthPercent,
		widthPercent,
		zeroOffsetPercent,
	};
}

export function CategoryBarChart({ data, metric }: CategoryBarChartProps) {
	const values = useMemo(
		() => data.map((row) => getCategoryMetricValue(row, metric)),
		[data, metric],
	);

	const { max, min } = useMemo(() => {
		return {
			max: Math.max(...values),
			min: Math.min(...values),
		};
	}, [values]);

	const zeroOffsetPercent = useMemo(() => {
		if (min >= 0) return 0;
		if (max <= 0) return 100;
		return (max / (max - min)) * 100;
	}, [max, min]);

	if (data.length === 0) {
		return (
			<p className="text-sm text-[hsl(var(--muted-foreground))]">
				No category data to chart yet.
			</p>
		);
	}

	return (
		<div className="space-y-3">
			<div className="space-y-3" role="img" aria-label="Bar chart by category">
				{data.map((row, index) => {
					const value = values[index];
					const { leftPercent, widthPercent } = getBarLayout(value, max, min);

					return (
						<div key={row.category} className="flex items-center gap-3">
							<p
								className="w-28 shrink-0 truncate text-right text-sm text-[hsl(var(--foreground))]"
								title={row.category}
							>
								{row.category}
							</p>

							<div className="relative h-8 flex-1">
								<div
									className="absolute inset-y-0 border-l border-[hsl(var(--border))]"
									style={{ left: `${zeroOffsetPercent}%` }}
								/>

								<div
									className="absolute inset-y-1 min-w-0"
									style={{
										left: `${leftPercent}%`,
										width: `${widthPercent}%`,
									}}
								>
									<div
										className={cn(
											"h-full rounded-sm",
											getBarColor(metric, value),
										)}
									/>
								</div>
							</div>

							<p className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">
								{formatCurrency(value)}
							</p>
						</div>
					);
				})}
			</div>

			{(min < 0 || max > 0) && (
				<p className="text-xs text-[hsl(var(--muted-foreground))]">
					Values range from {formatCurrency(min)} to {formatCurrency(max)}.
				</p>
			)}
		</div>
	);
}
