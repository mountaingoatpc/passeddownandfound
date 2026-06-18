import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { inventoryApi } from "@/api/inventory";
import {
	ItemForm,
	type ItemFormValues,
} from "@/components/inventory/item-form";
import { AppHeader, BackLink } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { resolveImageUrl } from "@/config";
import { isAnalysisInProgress } from "@/lib/analysis-status";
import { resolveItemImageUrls } from "@/lib/upload-item-images";

export const Route = createFileRoute("/_authenticated/inventory/$itemId")({
	component: EditItemPage,
});

function EditItemPage() {
	const { itemId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const {
		data: item,
		isLoading,
		error: loadError,
	} = useQuery({
		queryKey: ["inventory", itemId],
		queryFn: () => inventoryApi.get(itemId),
		refetchInterval: (query) => {
			const currentItem = query.state.data;
			return currentItem && isAnalysisInProgress(currentItem.analysis_status)
				? 3000
				: false;
		},
	});

	const saveMutation = useMutation({
		mutationFn: async (values: ItemFormValues) => {
			const imageUrls = await resolveItemImageUrls(values.images);

			return inventoryApi.update(itemId, {
				name: values.name,
				category: values.category,
				description: values.description,
				condition: values.condition,
				quantity: values.quantity,
				weight_pounds: values.weight_pounds,
				weight_ounces: values.weight_ounces,
				starting_bid: values.starting_bid,
				cost: values.cost,
				projected_sale_price: values.projected_sale_price,
				actual_sale_price: values.actual_sale_price,
				ai_evidence: values.aiEvidence,
				image_urls: imageUrls,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["inventory"] });
			await queryClient.invalidateQueries({ queryKey: ["inventory-metrics"] });
			navigate({ to: "/inventory" });
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to update item");
		},
	});

	const analyzeMutation = useMutation({
		mutationFn: async ({
			values,
			analysisContext,
		}: {
			values: ItemFormValues;
			analysisContext: string;
		}) => {
			const imageUrls = await resolveItemImageUrls(values.images);

			return inventoryApi.update(itemId, {
				name: values.name,
				category: values.category,
				description: values.description,
				condition: values.condition,
				quantity: values.quantity,
				weight_pounds: values.weight_pounds,
				weight_ounces: values.weight_ounces,
				starting_bid: values.starting_bid,
				cost: values.cost,
				projected_sale_price: values.projected_sale_price,
				actual_sale_price: values.actual_sale_price,
				ai_evidence: values.aiEvidence,
				image_urls: imageUrls,
				run_analysis: true,
				analysis_context: analysisContext || null,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["inventory"] });
			await queryClient.invalidateQueries({ queryKey: ["inventory-metrics"] });
			await queryClient.invalidateQueries({ queryKey: ["inventory", itemId] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () => inventoryApi.remove(itemId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["inventory"] });
			await queryClient.invalidateQueries({ queryKey: ["inventory-metrics"] });
			navigate({ to: "/inventory" });
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to remove item");
			setShowDeleteConfirm(false);
		},
	});

	const isPending =
		saveMutation.isPending ||
		analyzeMutation.isPending ||
		deleteMutation.isPending;

	if (isLoading) {
		return (
			<div className="min-h-dvh">
				<AppHeader title="Edit Item" />
				<main className="mx-auto max-w-lg px-4 py-4">
					<p className="text-sm text-[hsl(var(--muted-foreground))]">
						Loading item...
					</p>
				</main>
			</div>
		);
	}

	if (loadError || !item) {
		return (
			<div className="min-h-dvh">
				<AppHeader title="Edit Item" />
				<main className="mx-auto max-w-lg space-y-4 px-4 py-4">
					<BackLink to="/inventory" label="Back to inventory" />
					<p className="text-sm text-[hsl(var(--destructive))]">
						{loadError instanceof Error ? loadError.message : "Item not found"}
					</p>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-dvh">
			<AppHeader title="Edit Item" />

			<main className="mx-auto max-w-lg space-y-6 px-4 py-4 safe-bottom">
				<BackLink to="/inventory" label="Back to inventory" />

				<ItemForm
					key={`${item.uuid}-${item.analysis_status}-${item.updated_at}`}
					initialValues={{
						name: item.name,
						category: item.category,
						description: item.description,
						condition: item.condition,
						quantity: item.quantity,
						weight_pounds: item.weight_pounds,
						weight_ounces: item.weight_ounces,
						starting_bid: item.starting_bid,
						cost: item.cost,
						projected_sale_price: item.projected_sale_price,
						actual_sale_price: item.actual_sale_price,
						images: item.image_urls.map((path) => ({
							url: resolveImageUrl(path) ?? path,
							serverPath: path,
						})),
						aiEvidence: item.ai_evidence,
					}}
					onSubmit={(values) => {
						setError(null);
						saveMutation.mutate(values);
					}}
					onAnalyze={async (values, analysisContext) => {
						setError(null);
						await analyzeMutation.mutateAsync({ values, analysisContext });
					}}
					isPending={isPending}
					error={error}
					submitLabel="Save Changes"
					analysisStatus={item.analysis_status}
					analysisError={item.analysis_error}
				/>

				<div className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-4">
					{showDeleteConfirm ? (
						<div className="space-y-3">
							<p className="text-sm font-medium">Remove from inventory?</p>
							<p className="text-sm text-[hsl(var(--muted-foreground))]">
								This item will disappear from your inventory. The record is kept
								in our system but you will no longer see or edit it here.
							</p>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									className="flex-1"
									onClick={() => setShowDeleteConfirm(false)}
									disabled={deleteMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									type="button"
									variant="destructive"
									className="flex-1"
									onClick={() => deleteMutation.mutate()}
									disabled={deleteMutation.isPending}
								>
									{deleteMutation.isPending ? "Removing..." : "Remove"}
								</Button>
							</div>
						</div>
					) : (
						<Button
							type="button"
							variant="outline"
							className="w-full text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
							onClick={() => {
								setError(null);
								setShowDeleteConfirm(true);
							}}
							disabled={isPending}
						>
							Remove from inventory
						</Button>
					)}
				</div>
			</main>
		</div>
	);
}
