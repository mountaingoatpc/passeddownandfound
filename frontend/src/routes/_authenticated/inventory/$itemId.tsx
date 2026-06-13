import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { inventoryApi } from "@/api/inventory";
import {
	ItemForm,
	type ItemFormValues,
} from "@/components/inventory/item-form";
import { AppHeader, BackLink } from "@/components/layout/app-header";
import { resolveImageUrl } from "@/config";
import { resolveItemImageUrls } from "@/lib/upload-item-images";

export const Route = createFileRoute("/_authenticated/inventory/$itemId")({
	component: EditItemPage,
});

function EditItemPage() {
	const { itemId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);

	const {
		data: item,
		isLoading,
		error: loadError,
	} = useQuery({
		queryKey: ["inventory", itemId],
		queryFn: () => inventoryApi.get(itemId),
	});

	const updateMutation = useMutation({
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
			navigate({ to: "/inventory" });
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to update item");
		},
	});

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
					key={item.uuid}
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
						updateMutation.mutate(values);
					}}
					isPending={updateMutation.isPending}
					error={error}
					submitLabel="Save Changes"
				/>
			</main>
		</div>
	);
}
