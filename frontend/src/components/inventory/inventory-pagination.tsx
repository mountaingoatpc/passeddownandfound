import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const PAGE_SELECT_THRESHOLD = 20;

const controlClassName =
	"flex h-9 rounded-[var(--radius)] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

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
	const [pageInput, setPageInput] = useState(String(page));

	useEffect(() => {
		setPageInput(String(page));
	}, [page]);

	if (total === 0) return null;

	const start = (page - 1) * pageSize + 1;
	const end = Math.min(page * pageSize, total);

	function goToPage(value: number) {
		const nextPage = Math.min(Math.max(Math.trunc(value), 1), totalPages);
		setPageInput(String(nextPage));
		if (nextPage !== page) {
			onPageChange(nextPage);
		}
	}

	function commitPageInput() {
		const parsed = Number(pageInput);
		if (!Number.isFinite(parsed) || parsed < 1) {
			setPageInput(String(page));
			return;
		}
		goToPage(parsed);
	}

	return (
		<div className="flex flex-col gap-3 border-t border-[hsl(var(--border))] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-sm text-[hsl(var(--muted-foreground))]">
				Showing {start}–{end} of {total}
			</p>

			<div className="flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2 text-sm">
					<span className="text-[hsl(var(--muted-foreground))]">Per page</span>
					<select
						className={controlClassName}
						value={pageSize}
						onChange={(event) => onPageSizeChange(Number(event.target.value))}
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
					<label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
						<span>Page</span>
						{totalPages <= PAGE_SELECT_THRESHOLD ? (
							<select
								aria-label="Current page"
								className={`${controlClassName} w-16`}
								value={page}
								onChange={(event) => goToPage(Number(event.target.value))}
							>
								{Array.from({ length: totalPages }, (_, index) => {
									const pageNumber = index + 1;
									return (
										<option key={pageNumber} value={pageNumber}>
											{pageNumber}
										</option>
									);
								})}
							</select>
						) : (
							<input
								aria-label="Current page"
								type="number"
								min={1}
								max={totalPages}
								inputMode="numeric"
								className={`${controlClassName} w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
								value={pageInput}
								onChange={(event) => setPageInput(event.target.value)}
								onBlur={commitPageInput}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.currentTarget.blur();
									}
								}}
							/>
						)}
						<span>of {totalPages}</span>
					</label>
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
