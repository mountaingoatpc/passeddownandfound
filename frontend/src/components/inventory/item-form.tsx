import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { categoriesApi } from "@/api/categories";
import type { AnalysisStatus, ItemAiEvidence } from "@/api/inventory";
import { AnalysisProgressBanner } from "@/components/inventory/analysis-progress-banner";
import { AnalyzeDialog } from "@/components/inventory/analyze-dialog";
import { ConditionPicker } from "@/components/inventory/condition-picker";
import { ItemEvidencePanel } from "@/components/inventory/item-evidence-panel";
import {
	type ImageSlot,
	MultiImageCapture,
} from "@/components/inventory/multi-image-capture";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isAnalysisInProgress } from "@/lib/analysis-status";
import { isConditionComplete } from "@/lib/condition";
import { hasAiEvidence } from "@/lib/item-evidence";

export interface ItemFormImage {
	url: string;
	file?: File;
	serverPath?: string;
}

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
	images: ItemFormImage[];
	aiEvidence: ItemAiEvidence | null;
}

interface ItemFormProps {
	initialValues?: Partial<ItemFormValues> & {
		images?: ItemFormImage[];
		aiEvidence?: ItemAiEvidence | null;
	};
	onSubmit: (values: ItemFormValues) => void;
	onAnalyze: (values: ItemFormValues, analysisContext: string) => Promise<void>;
	isPending?: boolean;
	error?: string | null;
	submitLabel?: string;
	analysisStatus?: AnalysisStatus;
	analysisError?: string | null;
}

function numberToField(value: number | undefined, fallback = ""): string {
	return value === undefined ? fallback : String(value);
}

const selectClassName =
	"flex h-9 w-full rounded-[var(--radius)] border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50";

export function ItemForm({
	initialValues,
	onSubmit,
	onAnalyze,
	isPending = false,
	error = null,
	submitLabel = "Save Item",
	analysisStatus = "none",
	analysisError = null,
}: ItemFormProps) {
	const [name, setName] = useState(initialValues?.name ?? "");
	const [category, setCategory] = useState(initialValues?.category ?? "");
	const [description, setDescription] = useState(
		initialValues?.description ?? "",
	);
	const [condition, setCondition] = useState(initialValues?.condition ?? "");
	const [quantity, setQuantity] = useState(
		numberToField(initialValues?.quantity, "1"),
	);
	const [weightPounds, setWeightPounds] = useState(
		numberToField(initialValues?.weight_pounds, "0"),
	);
	const [weightOunces, setWeightOunces] = useState(
		numberToField(initialValues?.weight_ounces, "0"),
	);
	const [startingBid, setStartingBid] = useState(
		numberToField(initialValues?.starting_bid),
	);
	const [cost, setCost] = useState(numberToField(initialValues?.cost));
	const [projectedSalePrice, setProjectedSalePrice] = useState(
		numberToField(initialValues?.projected_sale_price),
	);
	const [actualSalePrice, setActualSalePrice] = useState(
		initialValues?.actual_sale_price != null
			? String(initialValues.actual_sale_price)
			: "",
	);
	const [images, setImages] = useState<ItemFormImage[]>(
		initialValues?.images ?? [],
	);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [analyzeDialogError, setAnalyzeDialogError] = useState<string | null>(
		null,
	);
	const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
	const aiEvidence = initialValues?.aiEvidence ?? null;
	const analyzing = isAnalysisInProgress(analysisStatus);
	const formDisabled = isPending || analyzing;

	const { data: categories = [] } = useQuery({
		queryKey: ["categories"],
		queryFn: () => categoriesApi.list(),
	});

	const categoryNames = categories.map((entry) => entry.name);
	const hasCategories = categories.length > 0;
	const categoryOptions =
		category.trim() && !categoryNames.includes(category)
			? [category, ...categoryNames]
			: categoryNames;

	const hasPhotos = images.length > 0;

	const handleImagesChange = (slots: ImageSlot[]) => {
		setImages((prev) =>
			slots.map((slot) => ({
				url: slot.url,
				file: slot.file,
				serverPath: prev.find((img) => img.url === slot.url)?.serverPath,
			})),
		);
		setAnalyzeDialogError(null);
	};

	const buildFormValues = (options: { allowEmptyName?: boolean } = {}) => ({
		name: name.trim() || (options.allowEmptyName ? "New item" : ""),
		category: category.trim(),
		description: description.trim(),
		condition,
		quantity: Number.parseInt(quantity, 10) || 1,
		weight_pounds: Number.parseInt(weightPounds, 10) || 0,
		weight_ounces: Number.parseFloat(weightOunces) || 0,
		starting_bid: Number.parseFloat(startingBid) || 0,
		cost: Number.parseFloat(cost) || 0,
		projected_sale_price: Number.parseFloat(projectedSalePrice) || 0,
		actual_sale_price: actualSalePrice
			? Number.parseFloat(actualSalePrice)
			: null,
		images,
		aiEvidence: hasAiEvidence(aiEvidence) ? aiEvidence : null,
	});

	const validateForm = (options: { requireName?: boolean } = {}) => {
		if (options.requireName && !name.trim()) {
			return "Name is required.";
		}

		if (condition && !isConditionComplete(condition)) {
			return "Please select a condition grade for pre-owned items.";
		}

		return null;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setValidationError(null);

		const errorMessage = validateForm({ requireName: true });
		if (errorMessage) {
			setValidationError(errorMessage);
			return;
		}

		onSubmit(buildFormValues());
	};

	const handleAnalyzeClick = () => {
		if (!hasPhotos) return;
		setAnalyzeDialogError(null);
		setShowAnalyzeDialog(true);
	};

	const handleAnalyzeRun = async (analysisContext: string) => {
		if (!hasPhotos) {
			throw new Error("Add at least one photo to analyze with AI.");
		}

		if (!hasCategories) {
			throw new Error(
				"Create at least one category before running AI analysis.",
			);
		}

		const errorMessage = validateForm({ requireName: false });
		if (errorMessage) {
			throw new Error(errorMessage);
		}

		await onAnalyze(buildFormValues({ allowEmptyName: true }), analysisContext);
	};

	const displayError = validationError ?? error;

	return (
		<>
			<AnalyzeDialog
				open={showAnalyzeDialog}
				onClose={() => {
					if (!isPending) setShowAnalyzeDialog(false);
				}}
				onError={(message) => setAnalyzeDialogError(message)}
				onRun={handleAnalyzeRun}
			/>
			<form onSubmit={handleSubmit} className="space-y-5">
				<AnalysisProgressBanner status={analysisStatus} error={analysisError} />
				<fieldset
					disabled={analyzing}
					className="space-y-5 border-0 p-0 m-0 min-w-0"
				>
					<div className="space-y-2">
						<p className="text-sm font-medium">Photos (up to 4)</p>
						<MultiImageCapture
							images={images}
							onChange={handleImagesChange}
							disabled={formDisabled}
						/>
						{hasPhotos && (
							<>
								<Button
									type="button"
									variant="secondary"
									className="w-full"
									onClick={handleAnalyzeClick}
									disabled={formDisabled || !hasCategories}
								>
									<Sparkles className="h-4 w-4" />
									Analyze with AI
								</Button>
								{!hasCategories && (
									<p className="text-sm text-[hsl(var(--muted-foreground))]">
										<Link
											to="/categories"
											className="text-[hsl(var(--primary))] hover:underline"
										>
											Create a category
										</Link>{" "}
										before running AI analysis.
									</p>
								)}
							</>
						)}
						{analyzeDialogError && (
							<p className="text-sm text-[hsl(var(--destructive))]">
								{analyzeDialogError}
							</p>
						)}
						{hasAiEvidence(aiEvidence) && (
							<ItemEvidencePanel
								evidence={aiEvidence!}
								title="Market evidence"
							/>
						)}
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
						{hasCategories ? (
							<select
								id="category"
								value={category}
								onChange={(event) => setCategory(event.target.value)}
								className={selectClassName}
								disabled={formDisabled}
							>
								<option value="">Select a category</option>
								{categoryOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						) : (
							<p className="text-sm text-[hsl(var(--muted-foreground))]">
								No categories yet.{" "}
								<Link
									to="/categories"
									className="text-[hsl(var(--primary))] hover:underline"
								>
									Create one
								</Link>{" "}
								to organize items and enable AI suggestions.
							</p>
						)}
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
							disabled={formDisabled}
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
							<CurrencyInput
								id="cost"
								value={cost}
								onChange={(e) => setCost(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<label htmlFor="starting-bid" className="text-sm font-medium">
								Starting Bid
							</label>
							<CurrencyInput
								id="starting-bid"
								value={startingBid}
								onChange={(e) => setStartingBid(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<label htmlFor="projected" className="text-sm font-medium">
								Projected Sale
							</label>
							<CurrencyInput
								id="projected"
								value={projectedSalePrice}
								onChange={(e) => setProjectedSalePrice(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<label htmlFor="actual" className="text-sm font-medium">
								Actual Sale
							</label>
							<CurrencyInput
								id="actual"
								value={actualSalePrice}
								onChange={(e) => setActualSalePrice(e.target.value)}
								placeholder="Optional"
							/>
						</div>
					</div>

					{displayError && (
						<p className="text-sm text-[hsl(var(--destructive))]">
							{displayError}
						</p>
					)}

					<Button
						type="submit"
						className="w-full"
						size="lg"
						disabled={formDisabled}
					>
						{isPending ? "Saving..." : submitLabel}
					</Button>
				</fieldset>
			</form>
		</>
	);
}
