import type { InventoryItem } from "@/api/inventory";

export interface InventoryMetrics {
	totalItems: number;
	totalCost: number;
	totalProjectedSale: number;
	projectedProfit: number;
	profit: number;
	itemsSold: number;
}

export type CategoryChartMetric =
	| "cost"
	| "projected_sale"
	| "projected_profit"
	| "profit";

export interface CategoryMetricRow {
	category: string;
	cost: number;
	projectedSale: number;
	projectedProfit: number;
	profit: number;
}

const UNCATEGORIZED_LABEL = "Uncategorized";

/** Realized profit only when an actual sale > 0 has been recorded. */
export function getItemProfit(item: {
	cost: number;
	actual_sale_price: number | null;
}): number | null {
	if (item.actual_sale_price == null || item.actual_sale_price <= 0) {
		return null;
	}
	return item.actual_sale_price - item.cost;
}

export function computeInventoryMetrics(
	items: InventoryItem[],
): InventoryMetrics {
	let totalCost = 0;
	let totalProjectedSale = 0;
	let profit = 0;
	let itemsSold = 0;

	for (const item of items) {
		const quantity = item.quantity || 1;
		totalCost += item.cost * quantity;
		totalProjectedSale += item.projected_sale_price * quantity;
		const itemProfit = getItemProfit(item);
		if (itemProfit != null) {
			profit += itemProfit * quantity;
			itemsSold += 1;
		}
	}

	return {
		totalItems: items.length,
		totalCost,
		totalProjectedSale,
		projectedProfit: totalProjectedSale - totalCost,
		profit,
		itemsSold,
	};
}

export function computeCategoryMetrics(
	items: InventoryItem[],
): CategoryMetricRow[] {
	const byCategory = new Map<
		string,
		{ cost: number; projectedSale: number; profit: number }
	>();

	for (const item of items) {
		const category = item.category.trim() || UNCATEGORIZED_LABEL;
		const quantity = item.quantity || 1;
		const cost = item.cost * quantity;
		const projectedSale = item.projected_sale_price * quantity;
		const itemProfit = getItemProfit(item);
		const existing = byCategory.get(category) ?? {
			cost: 0,
			projectedSale: 0,
			profit: 0,
		};

		byCategory.set(category, {
			cost: existing.cost + cost,
			projectedSale: existing.projectedSale + projectedSale,
			profit: existing.profit + (itemProfit != null ? itemProfit * quantity : 0),
		});
	}

	return Array.from(byCategory.entries())
		.map(([category, totals]) => ({
			category,
			cost: totals.cost,
			projectedSale: totals.projectedSale,
			projectedProfit: totals.projectedSale - totals.cost,
			profit: totals.profit,
		}))
		.sort((a, b) => a.category.localeCompare(b.category));
}

export function getCategoryMetricValue(
	row: CategoryMetricRow,
	metric: CategoryChartMetric,
): number {
	switch (metric) {
		case "cost":
			return row.cost;
		case "projected_sale":
			return row.projectedSale;
		case "projected_profit":
			return row.projectedProfit;
		case "profit":
			return row.profit;
	}
}

export const CATEGORY_CHART_METRIC_OPTIONS: {
	value: CategoryChartMetric;
	label: string;
}[] = [
	{ value: "cost", label: "Cost" },
	{ value: "projected_sale", label: "Projected Sale" },
	{ value: "projected_profit", label: "Projected Profit" },
	{ value: "profit", label: "Profit" },
];
