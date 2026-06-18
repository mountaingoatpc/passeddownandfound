import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

interface InventoryPaginationProps {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
}

export function InventoryPagination({
	page,
	pageSize,
	total,
	totalPages,
	onPageChange,
	onPageSizeChange,
}: InventoryPaginationProps) {
	if (total === 0) return null;

	const start = (page - 1) * pageSize + 1;
	const end = Math.min(page * pageSize, total);

	return (
		<div className="flex flex-col gap-3 border-t border-[hsl(var(--border))] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-sm text-[hsl(var(--muted-foreground))]">
				Showing {start}–{end} of {total}
			</p>

			<div className="flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2 text-sm">
					<span className="text-[hsl(var(--muted-foreground))]">Per page</span>
					<select
						className="flex h-9 rounded-[var(--radius)] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
						value={pageSize}
						onChange={(event) =>
							onPageSizeChange(Number(event.target.value))
						}
					>
						{PAGE_SIZE_OPTIONS.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
				</label>

				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
					>
						<ChevronLeft className="h-4 w-4" />
						Previous
					</Button>
					<span className="text-sm text-[hsl(var(--muted-foreground))]">
						Page {page} of {totalPages}
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
					>
						Next
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
