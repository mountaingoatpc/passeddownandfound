import { useState } from "react";
import type { ItemAiEvidence } from "@/api/inventory";
import { renderMarkdownLinks } from "@/lib/render-markdown-links";

interface ItemEvidencePanelProps {
	evidence: ItemAiEvidence;
	title?: string;
}

function formatPrice(value: number | null): string {
	if (value == null) return "—";
	return `$${value.toFixed(2)}`;
}

export function ItemEvidencePanel({
	evidence,
	title = "Market evidence",
}: ItemEvidencePanelProps) {
	const [showComparables, setShowComparables] = useState(false);
	const hasComparables = evidence.comparable_listings.length > 0;
	const hasEstimates = Object.keys(evidence.platform_estimates).length > 0;
	const hasReasoning = Boolean(evidence.reasoning?.trim());
	const hasConfidence = evidence.confidence != null;

	if (!hasComparables && !hasEstimates && !hasReasoning) {
		return null;
	}

	return (
		<div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4 space-y-3">
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm font-medium">{title}</p>
				{hasConfidence && (
					<span className="text-xs text-[hsl(var(--muted-foreground))]">
						Confidence: {Math.round((evidence.confidence ?? 0) * 100)}%
					</span>
				)}
			</div>
			{hasReasoning && (
				<p className="text-sm text-[hsl(var(--muted-foreground))]">
					{renderMarkdownLinks(evidence.reasoning ?? "")}
				</p>
			)}
			{hasEstimates && (
				<div className="flex flex-wrap gap-2">
					{Object.entries(evidence.platform_estimates).map(
						([platform, estimate]) => (
							<span
								key={platform}
								className="rounded-md bg-[hsl(var(--background))] px-2 py-1 text-xs"
							>
								{platform}: {formatPrice(estimate)}
							</span>
						),
					)}
				</div>
			)}
			{hasComparables && (
				<div className="space-y-2">
					<button
						type="button"
						className="text-sm font-medium text-[hsl(var(--primary))]"
						onClick={() => setShowComparables((open) => !open)}
					>
						{showComparables ? "Hide" : "Show"} similar listings (
						{evidence.comparable_listings.length})
					</button>
					{showComparables && (
						<ul className="space-y-2 text-sm">
							{evidence.comparable_listings.map((listing) => (
								<li
									key={`${listing.platform}-${listing.title}-${listing.url ?? listing.notes}`}
									className="rounded-md bg-[hsl(var(--background))] p-2"
								>
									<p className="font-medium">
										{listing.platform}: {listing.title}
									</p>
									<p className="text-[hsl(var(--muted-foreground))]">
										{formatPrice(listing.price)}
										{listing.notes ? ` — ${listing.notes}` : ""}
									</p>
									{listing.url && (
										<a
											href={listing.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-xs text-[hsl(var(--primary))] underline"
										>
											View listing
										</a>
									)}
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
