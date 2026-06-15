import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { inventoryApi } from "@/api/inventory";
import {
	ItemForm,
	type ItemFormValues,
} from "@/components/inventory/item-form";
import { AppHeader, BackLink } from "@/components/layout/app-header";
import { resolveItemImageUrls } from "@/lib/upload-item-images";

export const Route = createFileRoute("/_authenticated/inventory/new")({
	component: AddItemPage,
});

async function saveItemWithAnalysis(
	values: ItemFormValues,
	analysisContext: string,
) {
	const imageUrls = await resolveItemImageUrls(values.images);

	return inventoryApi.create({
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
		image_urls: imageUrls,
		ai_evidence: values.aiEvidence,
		run_analysis: true,
		analysis_context: analysisContext || null,
	});
}

function AddItemPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);

	const saveMutation = useMutation({
		mutationFn: async (values: ItemFormValues) => {
			const imageUrls = await resolveItemImageUrls(values.images);

			return inventoryApi.create({
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
				image_urls: imageUrls,
				ai_evidence: values.aiEvidence,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["inventory"] });
			navigate({ to: "/inventory" });
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to save item");
		},
	});

	const analyzeMutation = useMutation({
		mutationFn: ({
			values,
			analysisContext,
		}: {
			values: ItemFormValues;
			analysisContext: string;
		}) => saveItemWithAnalysis(values, analysisContext),
		onSuccess: async (item) => {
			await queryClient.invalidateQueries({ queryKey: ["inventory"] });
			navigate({
				to: "/inventory/$itemId",
				params: { itemId: item.uuid },
			});
		},
		onError: (err) => {
			throw err;
		},
	});

	const isPending = saveMutation.isPending || analyzeMutation.isPending;

	return (
		<div className="min-h-dvh">
			<AppHeader title="Add Item" />

			<main className="mx-auto max-w-lg space-y-6 px-4 py-4 safe-bottom">
				<BackLink to="/inventory" label="Back to inventory" />

				<ItemForm
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
				/>
			</main>
		</div>
	);
}
