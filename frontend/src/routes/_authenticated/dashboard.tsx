import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { inventoryApi } from "@/api/inventory";
import { CategoryBarChart } from "@/components/dashboard/category-bar-chart";
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
	const [chartMetric, setChartMetric] =
		useState<CategoryChartMetric>("projected_sale");

	const {
		data: metrics,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["inventory-metrics"],
		queryFn: () => inventoryApi.metrics(),
	});

	const categoryMetrics = useMemo<CategoryMetricRow[]>(
		() =>
			metrics?.by_category.map((row) => ({
				category: row.category,
				cost: row.cost,
				projectedSale: row.projected_sale,
				projectedProfit: row.projected_profit,
			})) ?? [],
		[metrics],
	);

	return (
		<div className="min-h-dvh">
			<AppHeader title="Dashboard" />

			<main className="mx-auto max-w-6xl space-y-6 px-4 py-4 safe-bottom">
				<div>
					<h2 className="text-lg font-semibold">Inventory Overview</h2>
					<p className="text-sm text-[hsl(var(--muted-foreground))]">
						Summary metrics across your inventory.
					</p>
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
								label="Items Sold"
								value={String(metrics.items_sold)}
								description="Inventory items with an actual sale price recorded"
							/>
						</div>

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
