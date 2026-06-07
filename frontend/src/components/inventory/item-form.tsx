import { useState } from "react";
import { CameraCapture } from "@/components/inventory/camera-capture";
import { ConditionPicker } from "@/components/inventory/condition-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isConditionComplete } from "@/lib/condition";

export interface ItemFormValues {
	name: string;
	category: string;
	description: string;
	condition: string;
	quantity: number;
	weight_pounds: number;
	weight_ounces: number;
	starting_bid: number;
	cost: number;
	projected_sale_price: number;
	actual_sale_price: number | null;
	imageFile: File | null;
	removeImage: boolean;
}

interface ItemFormProps {
	initialValues?: Partial<ItemFormValues> & { imagePreviewUrl?: string | null };
	onSubmit: (values: ItemFormValues) => void;
	isPending?: boolean;
	error?: string | null;
	submitLabel?: string;
}

function numberToField(value: number | undefined, fallback = ""): string {
	return value === undefined ? fallback : String(value);
}

export function ItemForm({
	initialValues,
	onSubmit,
	isPending = false,
	error = null,
	submitLabel = "Save Item",
}: ItemFormProps) {
	const [name, setName] = useState(initialValues?.name ?? "");
	const [category, setCategory] = useState(initialValues?.category ?? "");
	const [description, setDescription] = useState(initialValues?.description ?? "");
	const [condition, setCondition] = useState(initialValues?.condition ?? "");
	const [quantity, setQuantity] = useState(numberToField(initialValues?.quantity, "1"));
	const [weightPounds, setWeightPounds] = useState(
		numberToField(initialValues?.weight_pounds, "0"),
	);
	const [weightOunces, setWeightOunces] = useState(
		numberToField(initialValues?.weight_ounces, "0"),
	);
	const [startingBid, setStartingBid] = useState(numberToField(initialValues?.starting_bid));
	const [cost, setCost] = useState(numberToField(initialValues?.cost));
	const [projectedSalePrice, setProjectedSalePrice] = useState(
		numberToField(initialValues?.projected_sale_price),
	);
	const [actualSalePrice, setActualSalePrice] = useState(
		initialValues?.actual_sale_price != null
			? String(initialValues.actual_sale_price)
			: "",
	);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(
		initialValues?.imagePreviewUrl ?? null,
	);
	const [removeImage, setRemoveImage] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);

	const handleCapture = (file: File) => {
		if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
		setImageFile(file);
		setPreviewUrl(URL.createObjectURL(file));
		setRemoveImage(false);
	};

	const handleClearPhoto = () => {
		if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
		setImageFile(null);
		setPreviewUrl(null);
		setRemoveImage(true);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setValidationError(null);

		if (!name.trim()) {
			setValidationError("Name is required.");
			return;
		}

		if (condition && !isConditionComplete(condition)) {
			setValidationError("Please select a condition grade for pre-owned items.");
			return;
		}

		onSubmit({
			name: name.trim(),
			category: category.trim(),
			description: description.trim(),
			condition,
			quantity: Number.parseInt(quantity, 10) || 1,
			weight_pounds: Number.parseInt(weightPounds, 10) || 0,
			weight_ounces: Number.parseFloat(weightOunces) || 0,
			starting_bid: Number.parseFloat(startingBid) || 0,
			cost: Number.parseFloat(cost) || 0,
			projected_sale_price: Number.parseFloat(projectedSalePrice) || 0,
			actual_sale_price: actualSalePrice ? Number.parseFloat(actualSalePrice) : null,
			imageFile,
			removeImage,
		});
	};

	const displayError = validationError ?? error;

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="space-y-2">
				<p className="text-sm font-medium">Photo</p>
				<CameraCapture
					previewUrl={previewUrl}
					onCapture={handleCapture}
					onClear={handleClearPhoto}
					disabled={isPending}
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
				<label htmlFor="category" className="text-sm font-medium">
					Category
				</label>
				<Input
					id="category"
					value={category}
					onChange={(e) => setCategory(e.target.value)}
					placeholder="Furniture, jewelry, glassware..."
					className="h-9 text-sm"
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
					placeholder="Provenance, notes, dimensions..."
					rows={4}
				/>
			</div>

			<div className="space-y-2">
				<label htmlFor="condition-type" className="text-sm font-medium">
					Condition
				</label>
				<ConditionPicker
					value={condition}
					onChange={setCondition}
					disabled={isPending}
				/>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<label htmlFor="quantity" className="text-sm font-medium">
						Quantity
					</label>
					<Input
						id="quantity"
						type="number"
						inputMode="numeric"
						min="1"
						step="1"
						value={quantity}
						onChange={(e) => setQuantity(e.target.value)}
						placeholder="1"
					/>
				</div>

				<div className="space-y-2">
					<p className="text-sm font-medium">Weight</p>
					<div className="flex items-center gap-3">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<label
								htmlFor="weight-pounds"
								className="shrink-0 text-sm text-[hsl(var(--muted-foreground))]"
							>
								lbs
							</label>
							<Input
								id="weight-pounds"
								type="number"
								inputMode="numeric"
								min="0"
								step="1"
								value={weightPounds}
								onChange={(e) => setWeightPounds(e.target.value)}
								placeholder="0"
								className="h-9 min-w-0 flex-1 text-sm"
							/>
						</div>
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<label
								htmlFor="weight-ounces"
								className="shrink-0 text-sm text-[hsl(var(--muted-foreground))]"
							>
								oz
							</label>
							<Input
								id="weight-ounces"
								type="number"
								inputMode="decimal"
								min="0"
								step="0.1"
								value={weightOunces}
								onChange={(e) => setWeightOunces(e.target.value)}
								placeholder="0"
								className="h-9 min-w-0 flex-1 text-sm"
							/>
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
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
					<label htmlFor="starting-bid" className="text-sm font-medium">
						Starting Bid
					</label>
					<Input
						id="starting-bid"
						type="number"
						inputMode="decimal"
						min="0"
						step="0.01"
						value={startingBid}
						onChange={(e) => setStartingBid(e.target.value)}
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

			{displayError && (
				<p className="text-sm text-[hsl(var(--destructive))]">{displayError}</p>
			)}

			<Button type="submit" className="w-full" size="lg" disabled={isPending}>
				{isPending ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
