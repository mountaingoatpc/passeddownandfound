import type { ItemAiEvidence, ItemAnalysisResponse } from "@/api/inventory";

export function analysisToEvidence(
	result: ItemAnalysisResponse,
): ItemAiEvidence {
	return {
		comparable_listings: result.comparable_listings,
		platform_estimates: result.platform_estimates,
		confidence: result.confidence,
		reasoning: result.reasoning,
	};
}

export function hasAiEvidence(
	evidence: ItemAiEvidence | null | undefined,
): boolean {
	if (!evidence) return false;
	return (
		evidence.comparable_listings.length > 0 ||
		Object.keys(evidence.platform_estimates).length > 0 ||
		Boolean(evidence.reasoning?.trim())
	);
}
