import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { MetricsSeriesPoint } from "@/api/inventory";
import { formatCurrency } from "@/lib/format-currency";

interface SalesByPaymentChartProps {
	series: MetricsSeriesPoint[];
}

const STACK_KEYS = [
	{ key: "cash", label: "Cash", color: "hsl(175 38% 46%)" },
	{ key: "venmo", label: "Venmo", color: "hsl(210 70% 48%)" },
	{ key: "paypal", label: "PayPal", color: "hsl(28 80% 48%)" },
	{ key: "facebook_pay", label: "Facebook Pay", color: "hsl(250 45% 52%)" },
	{ key: "unknown", label: "Unknown", color: "hsl(24 10% 62%)" },
] as const;

export function SalesByPaymentChart({ series }: SalesByPaymentChartProps) {
	const data = series.map((point) => ({
		label: point.label,
		cash: point.by_payment_method.cash,
		venmo: point.by_payment_method.venmo,
		paypal: point.by_payment_method.paypal,
		facebook_pay: point.by_payment_method.facebook_pay,
		unknown: point.by_payment_method.unknown,
		gross_sales: point.gross_sales,
	}));

	const hasSales = data.some((row) => row.gross_sales > 0);

	if (!hasSales) {
		return (
			<p className="text-sm text-[hsl(var(--muted-foreground))]">
				No sales recorded in this time range yet.
			</p>
		);
	}

	return (
		<div
			className="h-72 w-full"
			role="img"
			aria-label="Sales by payment method"
		>
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
						tickFormatter={(value: number) =>
							value >= 1000
								? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
								: `$${value}`
						}
						width={52}
					/>
					<Tooltip
						cursor={{ fill: "hsl(var(--muted))" }}
						formatter={(value, name) => [
							formatCurrency(Number(value ?? 0)),
							STACK_KEYS.find((entry) => entry.key === name)?.label ??
								String(name),
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
					<Legend
						wrapperStyle={{
							fontSize: 12,
							color: "hsl(var(--muted-foreground))",
						}}
						formatter={(value) =>
							STACK_KEYS.find((entry) => entry.key === value)?.label ?? value
						}
					/>
					{STACK_KEYS.map((entry) => (
						<Bar
							key={entry.key}
							dataKey={entry.key}
							stackId="sales"
							fill={entry.color}
							radius={entry.key === "unknown" ? [4, 4, 0, 0] : [0, 0, 0, 0]}
							maxBarSize={48}
						/>
					))}
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
