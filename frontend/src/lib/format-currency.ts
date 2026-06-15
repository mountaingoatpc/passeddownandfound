export function formatCurrency(value: number | null | undefined): string {
	if (value === null || value === undefined) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(value);
}
