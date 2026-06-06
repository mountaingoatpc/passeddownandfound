import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { inventoryApi } from "@/api/inventory";
import { CameraCapture } from "@/components/inventory/camera-capture";
import { AppHeader, BackLink } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/inventory/new")({
	component: AddItemPage,
});

function AddItemPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [cost, setCost] = useState("");
	const [projectedSalePrice, setProjectedSalePrice] = useState("");
	const [actualSalePrice, setActualSalePrice] = useState("");
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const createMutation = useMutation({
		mutationFn: async () => {
			let imageUrl: string | null = null;

			if (imageFile) {
				const upload = await inventoryApi.uploadImage(imageFile);
				imageUrl = upload.image_url;
			}

			return inventoryApi.create({
				name: name.trim(),
				description: description.trim(),
				cost: Number.parseFloat(cost) || 0,
				projected_sale_price: Number.parseFloat(projectedSalePrice) || 0,
				actual_sale_price: actualSalePrice
					? Number.parseFloat(actualSalePrice)
					: null,
				image_url: imageUrl,
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

	const handleCapture = (file: File) => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		setImageFile(file);
		setPreviewUrl(URL.createObjectURL(file));
	};

	const handleClearPhoto = () => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		setImageFile(null);
		setPreviewUrl(null);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!name.trim()) {
			setError("Name is required.");
			return;
		}

		createMutation.mutate();
	};

	return (
		<div className="min-h-dvh">
			<AppHeader title="Add Item" />

			<main className="mx-auto max-w-lg space-y-6 px-4 py-4 safe-bottom">
				<BackLink to="/inventory" label="Back to inventory" />

				<form onSubmit={handleSubmit} className="space-y-5">
					<div className="space-y-2">
						<p className="text-sm font-medium">Photo</p>
						<CameraCapture
							previewUrl={previewUrl}
							onCapture={handleCapture}
							onClear={handleClearPhoto}
							disabled={createMutation.isPending}
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="name" className="text-sm font-medium">
							Name
						</label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Vintage brass lamp"
							required
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="description" className="text-sm font-medium">
							Description
						</label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Condition, provenance, notes..."
							rows={4}
						/>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="space-y-2">
							<label htmlFor="cost" className="text-sm font-medium">
								Cost
							</label>
							<Input
								id="cost"
								type="number"
								inputMode="decimal"
								min="0"
								step="0.01"
								value={cost}
								onChange={(e) => setCost(e.target.value)}
								placeholder="0.00"
							/>
						</div>

						<div className="space-y-2">
							<label htmlFor="projected" className="text-sm font-medium">
								Projected Sale
							</label>
							<Input
								id="projected"
								type="number"
								inputMode="decimal"
								min="0"
								step="0.01"
								value={projectedSalePrice}
								onChange={(e) => setProjectedSalePrice(e.target.value)}
								placeholder="0.00"
							/>
						</div>

						<div className="space-y-2">
							<label htmlFor="actual" className="text-sm font-medium">
								Actual Sale
							</label>
							<Input
								id="actual"
								type="number"
								inputMode="decimal"
								min="0"
								step="0.01"
								value={actualSalePrice}
								onChange={(e) => setActualSalePrice(e.target.value)}
								placeholder="Optional"
							/>
						</div>
					</div>

					{error && (
						<p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
					)}

					<Button
						type="submit"
						className="w-full"
						size="lg"
						disabled={createMutation.isPending}
					>
						{createMutation.isPending ? "Saving..." : "Save Item"}
					</Button>
				</form>
			</main>
		</div>
	);
}
