import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { inventoryApi } from "@/api/inventory";
import { InventoryPagination } from "@/components/inventory/inventory-pagination";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInProgressItemPolling } from "@/hooks/use-in-progress-item-polling";
import { isAnalysisInProgress } from "@/lib/analysis-status";

export const Route = createFileRoute("/_authenticated/inventory/")({
	component: InventoryPage,
});

const DEFAULT_PAGE_SIZE = 25;

function InventoryPage() {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(search), 300);
		return () => clearTimeout(timer);
	}, [search]);

	useEffect(() => {
		setPage(1);
	}, [debouncedSearch, pageSize]);

	const listQueryKey = useMemo(
		() => ["inventory", debouncedSearch, page, pageSize] as const,
		[debouncedSearch, page, pageSize],
	);

	const {
		data,
		isLoading,
		error,
	} = useQuery({
		queryKey: listQueryKey,
		queryFn: () =>
			inventoryApi.list({
				search: debouncedSearch || undefined,
				page,
				limit: pageSize,
			}),
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;
	const totalPages = data?.total_pages ?? 0;

	useInProgressItemPolling(listQueryKey, items);

	const hasAnalysisInProgress = useMemo(
		() => items.some((item) => isAnalysisInProgress(item.analysis_status)),
		[items],
	);

	const goToAddItem = () => navigate({ to: "/inventory/new" });

	const goToEditItem = (itemId: string) =>
		navigate({ to: "/inventory/$itemId", params: { itemId } });

	return (
		<div className="min-h-dvh">
			<AppHeader
				title="Inventory"
				action={
					<Button size="sm" onClick={goToAddItem}>
						<Plus className="h-4 w-4" />
						<span className="hidden sm:inline">Add Item</span>
						<span className="sm:hidden">Add</span>
					</Button>
				}
			/>

			<main className="mx-auto max-w-6xl space-y-4 px-4 py-4 safe-bottom">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
					<Input
						type="search"
						placeholder="Search by name or description..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>

				{hasAnalysisInProgress && (
					<p className="text-sm text-[hsl(var(--muted-foreground))]">
						AI analysis in progress — status updates automatically.
					</p>
				)}

				{isLoading && (
					<p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
						Loading inventory...
					</p>
				)}

				{error && (
					<p className="text-center text-sm text-[hsl(var(--destructive))]">
						{error instanceof Error
							? error.message
							: "Failed to load inventory"}
					</p>
				)}

				{!isLoading && !error && total === 0 && (
					<div className="rounded-[var(--radius)] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
						<p className="text-[hsl(var(--muted-foreground))]">
							{debouncedSearch
								? "No items match your search."
								: "No items yet. Add your first find!"}
						</p>
						<Button className="mt-4" onClick={goToAddItem}>
							<Plus className="h-4 w-4" />
							Add Item
						</Button>
					</div>
				)}

				{items.length > 0 && (
					<div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
						<InventoryTable items={items} onItemClick={goToEditItem} />
						<InventoryPagination
							page={page}
							pageSize={pageSize}
							total={total}
							totalPages={totalPages}
							onPageChange={setPage}
							onPageSizeChange={setPageSize}
						/>
					</div>
				)}
			</main>
		</div>
	);
}
