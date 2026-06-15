import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AnalyzeDialogProps {
	open: boolean;
	onClose: () => void;
	onError: (message: string) => void;
	onRun?: (additionalContext: string) => Promise<void>;
	runAnalysis?: (additionalContext: string) => Promise<void>;
}

export function AnalyzeDialog({
	open,
	onClose,
	onError,
	onRun,
	runAnalysis,
}: AnalyzeDialogProps) {
	const executeAnalysis = onRun ?? runAnalysis;
	const [additionalContext, setAdditionalContext] = useState("");
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [isRunning, setIsRunning] = useState(false);

	useEffect(() => {
		if (!open) {
			setAdditionalContext("");
			setStatusMessage(null);
			setIsRunning(false);
		}
	}, [open]);

	if (!open) return null;

	const handleRun = async () => {
		if (!executeAnalysis) {
			onError("Analysis handler is not configured.");
			return;
		}

		setIsRunning(true);
		setStatusMessage("Saving item and starting analysis...");

		try {
			await executeAnalysis(additionalContext);
			onClose();
		} catch (err) {
			onError(err instanceof Error ? err.message : "Failed to start analysis");
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
			<button
				type="button"
				className="absolute inset-0 bg-black/40"
				onClick={isRunning ? undefined : onClose}
				aria-label="Close analyze dialog"
			/>
			<div
				className="relative w-full max-w-md rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-lg safe-bottom"
				role="dialog"
				aria-modal="true"
				aria-labelledby="analyze-dialog-title"
			>
				<div className="mb-4 flex items-start justify-between gap-3">
					<div>
						<h2 id="analyze-dialog-title" className="text-lg font-semibold">
							Analyze with AI
						</h2>
						<p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
							Your item will be saved automatically. You can return to inventory
							while analysis runs in the background.
						</p>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
						disabled={isRunning}
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="space-y-2">
					<label htmlFor="additional-context" className="text-sm font-medium">
						Additional context (optional)
					</label>
					<Textarea
						id="additional-context"
						value={additionalContext}
						onChange={(e) => setAdditionalContext(e.target.value)}
						placeholder="Maker, year, provenance, flaws, where you found it..."
						rows={4}
						disabled={isRunning}
						maxLength={2000}
					/>
				</div>

				{statusMessage && (
					<div className="mt-4 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
						{isRunning && (
							<span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
						)}
						<span>{statusMessage}</span>
					</div>
				)}

				<div className="mt-5 flex gap-2">
					<Button
						type="button"
						variant="outline"
						className="flex-1"
						onClick={onClose}
						disabled={isRunning}
					>
						Cancel
					</Button>
					<Button
						type="button"
						className="flex-1"
						onClick={handleRun}
						disabled={isRunning}
					>
						<Sparkles className="h-4 w-4" />
						{isRunning ? "Saving..." : "Run analysis"}
					</Button>
				</div>
			</div>
		</div>
	);
}
