import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { inventoryApi } from "@/api/inventory";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveImageUrl } from "@/config";

export const Route = createFileRoute("/_authenticated/inventory/")({
	component: InventoryPage,
});

function formatCurrency(value: number | null | undefined): string {
	if (value === null || value === undefined) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(value);
}

function InventoryPage() {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(search), 300);
		return () => clearTimeout(timer);
	}, [search]);

	const {
		data: items = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["inventory", debouncedSearch],
		queryFn: () => inventoryApi.list(debouncedSearch || undefined),
	});

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

				{!isLoading && !error && items.length === 0 && (
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
										return (
											<tr
												key={item.uuid}
												onClick={() => goToEditItem(item.uuid)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														goToEditItem(item.uuid);
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
																className="h-12 w-12 rounded-md object-cover"
															/>
															{extraCount > 0 && (
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
													{item.name}
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
					</div>
				)}
			</main>
		</div>
	);
}
