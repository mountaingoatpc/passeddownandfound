import { Loader2 } from "lucide-react";
import type { InventoryItemSummary } from "@/api/inventory";
import { resolveImageUrl } from "@/config";
import { isAnalysisInProgress } from "@/lib/analysis-status";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format-currency";

interface InventoryTableProps {
	items: InventoryItemSummary[];
	onItemClick: (itemId: string) => void;
}

export function InventoryTable({ items, onItemClick }: InventoryTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[720px] text-left text-sm">
				<thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/60">
					<tr>
						<th className="px-3 py-3 font-medium">Photo</th>
						<th className="px-3 py-3 font-medium">Name</th>
						<th className="px-3 py-3 font-medium">Description</th>
						<th className="px-3 py-3 font-medium">Cost</th>
						<th className="px-3 py-3 font-medium">Projected Sale</th>
						<th className="px-3 py-3 font-medium">Actual Sale</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => {
						const imageSrc = resolveImageUrl(item.image_urls[0]);
						const extraCount = item.image_urls.length - 1;
						const analyzing = isAnalysisInProgress(item.analysis_status);

						return (
							<tr
								key={item.uuid}
								onClick={() => onItemClick(item.uuid)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onItemClick(item.uuid);
									}
								}}
								tabIndex={0}
								role="link"
								className="cursor-pointer border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))]/30 focus-visible:bg-[hsl(var(--muted))]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))]"
							>
								<td className="px-3 py-3">
									{imageSrc ? (
										<div className="relative h-12 w-12">
											<img
												src={imageSrc}
												alt={item.name}
												loading="lazy"
												className={cn(
													"h-12 w-12 rounded-md object-cover",
													analyzing && "opacity-60",
												)}
											/>
											{analyzing && (
												<div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/35">
													<Loader2 className="h-5 w-5 animate-spin text-white" />
												</div>
											)}
											{extraCount > 0 && !analyzing && (
												<span className="absolute -bottom-1 -right-1 rounded-full bg-[hsl(var(--foreground))] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[hsl(var(--background))]">
													+{extraCount}
												</span>
											)}
										</div>
									) : (
										<div className="flex h-12 w-12 items-center justify-center rounded-md bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))]">
											No photo
										</div>
									)}
								</td>
								<td className="max-w-[12rem] truncate px-3 py-3 font-medium">
									<div className="flex items-center gap-2">
										{analyzing && (
											<Loader2 className="h-4 w-4 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" />
										)}
										<span className="truncate">{item.name}</span>
									</div>
								</td>
								<td className="max-w-xs truncate px-3 py-3 text-[hsl(var(--muted-foreground))]">
									{item.description || "—"}
								</td>
								<td className="px-3 py-3 whitespace-nowrap">
									{formatCurrency(item.cost)}
								</td>
								<td className="px-3 py-3 whitespace-nowrap">
									{formatCurrency(item.projected_sale_price)}
								</td>
								<td className="px-3 py-3 whitespace-nowrap">
									{formatCurrency(item.actual_sale_price)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
