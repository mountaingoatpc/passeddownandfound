import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { MetricsSeriesPoint } from "@/api/inventory";
import { formatCurrency } from "@/lib/format-currency";

export type TimeSeriesMetric =
	| "gross_sales"
	| "profit"
	| "items_sold"
	| "avg_sale_price";

export const TIME_SERIES_METRIC_OPTIONS: {
	value: TimeSeriesMetric;
	label: string;
}[] = [
	{ value: "gross_sales", label: "Gross Sales" },
	{ value: "profit", label: "Profit" },
	{ value: "items_sold", label: "Items Sold" },
	{ value: "avg_sale_price", label: "Avg Sale Price" },
];

interface MetricsOverTimeChartProps {
	series: MetricsSeriesPoint[];
	metric: TimeSeriesMetric;
}

function formatMetricValue(metric: TimeSeriesMetric, value: number): string {
	if (metric === "items_sold") {
		return String(value);
	}
	return formatCurrency(value);
}

function yTickFormatter(metric: TimeSeriesMetric, value: number): string {
	if (metric === "items_sold") {
		return String(value);
	}
	if (value >= 1000) {
		return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
	}
	return `$${value}`;
}

export function MetricsOverTimeChart({
	series,
	metric,
}: MetricsOverTimeChartProps) {
	const data = series.map((point) => ({
		label: point.label,
		value: point[metric],
	}));

	const hasValues = data.some((row) => row.value !== 0);

	if (!hasValues) {
		return (
			<p className="text-sm text-[hsl(var(--muted-foreground))]">
				No data for this metric in the selected time range.
			</p>
		);
	}

	const isProfit = metric === "profit";

	return (
		<div className="h-72 w-full" role="img" aria-label="Metrics over time">
			<ResponsiveContainer width="100%" height="100%">
				<BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
					<CartesianGrid
						strokeDasharray="3 3"
						stroke="hsl(var(--border))"
						vertical={false}
					/>
					<XAxis
						dataKey="label"
						tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
						tickLine={false}
						axisLine={{ stroke: "hsl(var(--border))" }}
					/>
					<YAxis
						tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value: number) => yTickFormatter(metric, value)}
						width={52}
					/>
					<Tooltip
						cursor={{ fill: "hsl(var(--muted))" }}
						formatter={(value) => [
							formatMetricValue(metric, Number(value ?? 0)),
							TIME_SERIES_METRIC_OPTIONS.find(
								(option) => option.value === metric,
							)?.label ?? metric,
						]}
						labelFormatter={(label) => String(label)}
						contentStyle={{
							borderRadius: "var(--radius)",
							border: "1px solid hsl(var(--border))",
							background: "hsl(var(--card))",
							color: "hsl(var(--foreground))",
							fontSize: 12,
						}}
					/>
					<Bar
						dataKey="value"
						fill={isProfit ? "hsl(var(--success))" : "hsl(var(--primary))"}
						radius={[4, 4, 0, 0]}
						maxBarSize={48}
					/>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
