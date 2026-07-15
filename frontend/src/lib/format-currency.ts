export function formatCurrency(value: number | null | undefined): string {
	if (value === null || value === undefined) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

/** Formats a dollar amount for controlled currency inputs (e.g. "10.00"). */
export function formatCurrencyInputValue(
	value: number | null | undefined,
	fallback = "",
): string {
	if (value === null || value === undefined) return fallback;
	return value.toFixed(2);
}
