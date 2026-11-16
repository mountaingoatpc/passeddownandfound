import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
	inventoryApi,
	METRICS_PERIOD_OPTIONS,
	type MetricsPeriod,
} from "@/api/inventory";
import { CategoryBarChart } from "@/components/dashboard/category-bar-chart";
import {
	MetricsOverTimeChart,
	TIME_SERIES_METRIC_OPTIONS,
	type TimeSeriesMetric,
} from "@/components/dashboard/metrics-over-time-chart";
import { SalesByPaymentChart } from "@/components/dashboard/sales-by-payment-chart";
import { AppHeader } from "@/components/layout/app-header";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format-currency";
import {
	CATEGORY_CHART_METRIC_OPTIONS,
	type CategoryChartMetric,
	type CategoryMetricRow,
} from "@/lib/inventory-metrics";

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: DashboardPage,
});

const selectClassName =
	"flex h-9 rounded-[var(--radius)] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

interface MetricCardProps {
	label: string;
	value: string;
	description?: string;
	valueClassName?: string;
}

function MetricCard({
	label,
	value,
	description,
	valueClassName,
}: MetricCardProps) {
	return (
		<div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
			<p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
			<p className={cn("mt-1 text-2xl font-semibold", valueClassName)}>
				{value}
			</p>
			{description && (
				<p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
					{description}
				</p>
			)}
		</div>
	);
}

function DashboardPage() {
	const [period, setPeriod] = useState<MetricsPeriod>("month");
	const [timeMetric, setTimeMetric] = useState<TimeSeriesMetric>("gross_sales");
	const [chartMetric, setChartMetric] =
		useState<CategoryChartMetric>("projected_sale");

	const {
		data: metrics,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["inventory-metrics", period],
		queryFn: () => inventoryApi.metrics({ period }),
	});

	const categoryMetrics = useMemo<CategoryMetricRow[]>(
		() =>
			metrics?.by_category.map((row) => ({
				category: row.category,
				cost: row.cost,
				projectedSale: row.projected_sale,
				projectedProfit: row.projected_profit,
				grossSales: row.gross_sales,
				profit: row.profit,
				avgSalePrice: row.avg_sale_price,
				avgProfit: row.avg_profit,
			})) ?? [],
		[metrics],
	);

	const periodLabel =
		METRICS_PERIOD_OPTIONS.find((option) => option.value === period)?.label ??
		"Month";

	return (
		<div className="min-h-dvh">
			<AppHeader title="Dashboard" />

			<main className="mx-auto max-w-6xl space-y-6 px-4 py-4 safe-bottom">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-lg font-semibold">Inventory Overview</h2>
						<p className="text-sm text-[hsl(var(--muted-foreground))]">
							Summary metrics across your inventory.
						</p>
					</div>
					<label className="flex flex-col gap-1 text-sm">
						<span className="text-[hsl(var(--muted-foreground))]">
							Time dimension
						</span>
						<select
							className={selectClassName}
							value={period}
							onChange={(event) =>
								setPeriod(event.target.value as MetricsPeriod)
							}
						>
							{METRICS_PERIOD_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
				</div>

				{isLoading && (
					<p className="text-sm text-[hsl(var(--muted-foreground))]">
						Loading metrics...
					</p>
				)}

				{error && (
					<p className="text-sm text-[hsl(var(--destructive))]">
						{error instanceof Error
							? error.message
							: "Failed to load inventory metrics"}
					</p>
				)}

				{!isLoading && !error && metrics && (
					<>
						<div className="grid gap-4 sm:grid-cols-2">
							<MetricCard
								label="Total Items"
								value={String(metrics.total_items)}
								description="Active inventory items in your collection"
							/>
							<MetricCard
								label="Total Cost"
								value={formatCurrency(metrics.total_cost)}
								description="Sum of item costs × quantity"
							/>
							<MetricCard
								label="Total Projected Sale"
								value={formatCurrency(metrics.total_projected_sale)}
								description="Sum of projected sale prices × quantity"
							/>
							<MetricCard
								label="Projected Profit"
								value={formatCurrency(metrics.projected_profit)}
								description="Projected sale minus total cost"
								valueClassName={
									metrics.projected_profit >= 0
										? "text-[hsl(var(--success))]"
										: "text-[hsl(var(--destructive))]"
								}
							/>
							<MetricCard
								label="Gross Sales"
								value={formatCurrency(metrics.gross_sales)}
								description="Sum of actual sale prices × quantity"
							/>
							<MetricCard
								label="Profit"
								value={formatCurrency(metrics.profit)}
								description="Actual sale minus cost for items sold"
								valueClassName={
									metrics.profit >= 0
										? "text-[hsl(var(--success))]"
										: "text-[hsl(var(--destructive))]"
								}
							/>
							<MetricCard
								label="Avg Sale Price"
								value={formatCurrency(metrics.avg_sale_price)}
								description="Average actual sale price for items sold"
							/>
							<MetricCard
								label="Avg Profit"
								value={formatCurrency(metrics.avg_profit)}
								description="Average profit for items sold"
								valueClassName={
									metrics.avg_profit >= 0
										? "text-[hsl(var(--success))]"
										: "text-[hsl(var(--destructive))]"
								}
							/>
							<MetricCard
								label="Items Sold"
								value={String(metrics.items_sold)}
								description="Inventory items with an actual sale price recorded"
							/>
						</div>

						<section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
							<div>
								<h3 className="font-semibold">Sales by payment method</h3>
								<p className="text-sm text-[hsl(var(--muted-foreground))]">
									Gross sales over time by {periodLabel.toLowerCase()}, stacked
									by how buyers paid.
								</p>
							</div>
							<div className="mt-6">
								<SalesByPaymentChart series={metrics.series} />
							</div>
						</section>

						<section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h3 className="font-semibold">Metrics over time</h3>
									<p className="text-sm text-[hsl(var(--muted-foreground))]">
										Track sales metrics across the selected{" "}
										{periodLabel.toLowerCase()} buckets.
									</p>
								</div>
								<label className="flex flex-col gap-1 text-sm">
									<span className="text-[hsl(var(--muted-foreground))]">
										Metric
									</span>
									<select
										className={selectClassName}
										value={timeMetric}
										onChange={(event) =>
											setTimeMetric(event.target.value as TimeSeriesMetric)
										}
									>
										{TIME_SERIES_METRIC_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="mt-6">
								<MetricsOverTimeChart
									series={metrics.series}
									metric={timeMetric}
								/>
							</div>
						</section>

						<section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h3 className="font-semibold">By Category</h3>
									<p className="text-sm text-[hsl(var(--muted-foreground))]">
										Compare totals across inventory categories.
									</p>
								</div>
								<label className="flex flex-col gap-1 text-sm">
									<span className="text-[hsl(var(--muted-foreground))]">
										Metric
									</span>
									<select
										className={selectClassName}
										value={chartMetric}
										onChange={(event) =>
											setChartMetric(event.target.value as CategoryChartMetric)
										}
									>
										{CATEGORY_CHART_METRIC_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</label>
							</div>

							<div className="mt-6">
								<CategoryBarChart data={categoryMetrics} metric={chartMetric} />
							</div>
						</section>
					</>
				)}
			</main>
		</div>
	);
}
