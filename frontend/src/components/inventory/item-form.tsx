import { Sparkles } from "lucide-react";
import { useState } from "react";
import {
	type ItemAiEvidence,
	type ItemAnalysisResponse,
	inventoryApi,
} from "@/api/inventory";
import { AnalyzeDialog } from "@/components/inventory/analyze-dialog";
import {
	MultiImageCapture,
	type ImageSlot,
} from "@/components/inventory/multi-image-capture";
import { ConditionPicker } from "@/components/inventory/condition-picker";
import { ItemEvidencePanel } from "@/components/inventory/item-evidence-panel";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isConditionComplete } from "@/lib/condition";
import { analysisToEvidence, hasAiEvidence } from "@/lib/item-evidence";

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
	const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [aiEvidence, setAiEvidence] = useState<ItemAiEvidence | null>(
		initialValues?.aiEvidence ?? null,
	);
	const [evidenceIsFresh, setEvidenceIsFresh] = useState(false);
	const [analysisError, setAnalysisError] = useState<string | null>(null);

	const applyAnalysis = (result: ItemAnalysisResponse) => {
		setName(result.name);
		setCategory(result.category);
		setDescription(result.description);
		if (isConditionComplete(result.condition_suggestion)) {
			setCondition(result.condition_suggestion);
		}
		setProjectedSalePrice(String(result.projected_sale_price));
		setStartingBid(String(result.starting_bid_suggestion));
	};

	const handleImagesChange = (slots: ImageSlot[]) => {
		setImages((prev) =>
			slots.map((slot) => ({
				url: slot.url,
				file: slot.file,
				serverPath: prev.find((img) => img.url === slot.url)?.serverPath,
			})),
		);
		setAnalysisError(null);
	};

	const analyzeImageFile = images.find((image) => image.file)?.file;

	const handleAnalyzeClick = () => {
		if (!analyzeImageFile) return;
		setAnalysisError(null);
		setShowAnalyzeDialog(true);
	};

	const handleAnalysisComplete = (result: ItemAnalysisResponse) => {
		setAiEvidence(analysisToEvidence(result));
		setEvidenceIsFresh(true);
		applyAnalysis(result);
		setAnalysisError(null);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setValidationError(null);

		if (!name.trim()) {
			setValidationError("Name is required.");
			return;
		}

		if (condition && !isConditionComplete(condition)) {
			setValidationError(
				"Please select a condition grade for pre-owned items.",
			);
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
			actual_sale_price: actualSalePrice
				? Number.parseFloat(actualSalePrice)
				: null,
			images,
			aiEvidence: hasAiEvidence(aiEvidence) ? aiEvidence : null,
		});
	};

	const displayError = validationError ?? error;

	return (
		<>
			<AnalyzeDialog
				open={showAnalyzeDialog}
				onClose={() => {
					if (!isAnalyzing) setShowAnalyzeDialog(false);
				}}
				onComplete={handleAnalysisComplete}
				onError={(message) => setAnalysisError(message)}
				runAnalysis={async (additionalContext, onStatus) => {
					if (!analyzeImageFile) {
						throw new Error("No image selected");
					}
					setIsAnalyzing(true);
					try {
						return await inventoryApi.analyzeImageStream(
							analyzeImageFile,
							additionalContext,
							onStatus,
						);
					} finally {
						setIsAnalyzing(false);
					}
				}}
			/>
			<form onSubmit={handleSubmit} className="space-y-5">
				<div className="space-y-2">
					<p className="text-sm font-medium">Photos (up to 4)</p>
					<MultiImageCapture
						images={images}
						onChange={handleImagesChange}
						disabled={isPending || isAnalyzing}
					/>
					{analyzeImageFile && (
						<Button
							type="button"
							variant="secondary"
							className="w-full"
							onClick={handleAnalyzeClick}
							disabled={isPending || isAnalyzing}
						>
							<Sparkles className="h-4 w-4" />
							Analyze with AI
						</Button>
					)}
					{analysisError && (
						<p className="text-sm text-[hsl(var(--destructive))]">
							{analysisError}
						</p>
					)}
					{hasAiEvidence(aiEvidence) && (
						<ItemEvidencePanel
							evidence={aiEvidence!}
							title={evidenceIsFresh ? "AI Analysis" : "Market evidence"}
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
					disabled={isPending || isAnalyzing}
				>
					{isPending ? "Saving..." : submitLabel}
				</Button>
			</form>
		</>
	);
}
