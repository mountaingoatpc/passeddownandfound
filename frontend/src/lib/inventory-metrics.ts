import type { InventoryItem } from "@/api/inventory";

export interface InventoryMetrics {
	totalItems: number;
	totalCost: number;
	totalProjectedSale: number;
	projectedProfit: number;
	grossSales: number;
	profit: number;
	avgSalePrice: number;
	avgProfit: number;
	itemsSold: number;
}

export type CategoryChartMetric =
	| "cost"
	| "projected_sale"
	| "projected_profit"
	| "gross_sales"
	| "profit"
	| "avg_sale_price"
	| "avg_profit";

export interface CategoryMetricRow {
	category: string;
	cost: number;
	projectedSale: number;
	projectedProfit: number;
	grossSales: number;
	profit: number;
	avgSalePrice: number;
	avgProfit: number;
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

function average(total: number, count: number): number {
	return count > 0 ? total / count : 0;
}

export function computeInventoryMetrics(
	items: InventoryItem[],
): InventoryMetrics {
	let totalCost = 0;
	let totalProjectedSale = 0;
	let grossSales = 0;
	let profit = 0;
	let salePriceSum = 0;
	let unitProfitSum = 0;
	let itemsSold = 0;

	for (const item of items) {
		const quantity = item.quantity || 1;
		totalCost += item.cost * quantity;
		totalProjectedSale += item.projected_sale_price * quantity;
		const itemProfit = getItemProfit(item);
		if (itemProfit != null && item.actual_sale_price != null) {
			grossSales += item.actual_sale_price * quantity;
			profit += itemProfit * quantity;
			salePriceSum += item.actual_sale_price;
			unitProfitSum += itemProfit;
			itemsSold += 1;
		}
	}

	return {
		totalItems: items.length,
		totalCost,
		totalProjectedSale,
		projectedProfit: totalProjectedSale - totalCost,
		grossSales,
		profit,
		avgSalePrice: average(salePriceSum, itemsSold),
		avgProfit: average(unitProfitSum, itemsSold),
		itemsSold,
	};
}

export function computeCategoryMetrics(
	items: InventoryItem[],
): CategoryMetricRow[] {
	const byCategory = new Map<
		string,
		{
			cost: number;
			projectedSale: number;
			grossSales: number;
			profit: number;
			salePriceSum: number;
			unitProfitSum: number;
			itemsSold: number;
		}
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
			grossSales: 0,
			profit: 0,
			salePriceSum: 0,
			unitProfitSum: 0,
			itemsSold: 0,
		};

		const sold = itemProfit != null && item.actual_sale_price != null;

		byCategory.set(category, {
			cost: existing.cost + cost,
			projectedSale: existing.projectedSale + projectedSale,
			grossSales:
				existing.grossSales +
				(sold && item.actual_sale_price != null
					? item.actual_sale_price * quantity
					: 0),
			profit:
				existing.profit + (itemProfit != null ? itemProfit * quantity : 0),
			salePriceSum:
				existing.salePriceSum +
				(sold && item.actual_sale_price != null ? item.actual_sale_price : 0),
			unitProfitSum:
				existing.unitProfitSum + (itemProfit != null ? itemProfit : 0),
			itemsSold: existing.itemsSold + (sold ? 1 : 0),
		});
	}

	return Array.from(byCategory.entries())
		.map(([category, totals]) => ({
			category,
			cost: totals.cost,
			projectedSale: totals.projectedSale,
			projectedProfit: totals.projectedSale - totals.cost,
			grossSales: totals.grossSales,
			profit: totals.profit,
			avgSalePrice: average(totals.salePriceSum, totals.itemsSold),
			avgProfit: average(totals.unitProfitSum, totals.itemsSold),
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
		case "gross_sales":
			return row.grossSales;
		case "profit":
			return row.profit;
		case "avg_sale_price":
			return row.avgSalePrice;
		case "avg_profit":
			return row.avgProfit;
	}
}

export const CATEGORY_CHART_METRIC_OPTIONS: {
	value: CategoryChartMetric;
	label: string;
}[] = [
	{ value: "cost", label: "Cost" },
	{ value: "projected_sale", label: "Projected Sale" },
	{ value: "projected_profit", label: "Projected Profit" },
	{ value: "gross_sales", label: "Gross Sales" },
	{ value: "profit", label: "Profit" },
	{ value: "avg_sale_price", label: "Avg Sale Price" },
	{ value: "avg_profit", label: "Avg Profit" },
];
