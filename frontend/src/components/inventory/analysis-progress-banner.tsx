import { Loader2 } from "lucide-react";
import type { AnalysisStatus } from "@/api/inventory";
import { isAnalysisInProgress } from "@/lib/analysis-status";

interface AnalysisProgressBannerProps {
	status: AnalysisStatus;
	error?: string | null;
}

export function AnalysisProgressBanner({
	status,
	error,
}: AnalysisProgressBannerProps) {
	if (status === "failed" && error) {
		return (
			<div className="rounded-[var(--radius)] border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-4 py-3 text-sm text-[hsl(var(--destructive))]">
				AI analysis failed: {error}
			</div>
		);
	}

	if (!isAnalysisInProgress(status)) {
		return null;
	}

	const message =
		status === "queued"
			? "AI analysis is queued..."
			: "AI analysis in progress...";

	return (
		<div className="flex items-center gap-3 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-4 py-3">
			<Loader2 className="h-5 w-5 shrink-0 animate-spin text-[hsl(var(--primary))]" />
			<div>
				<p className="text-sm font-medium">{message}</p>
				<p className="text-sm text-[hsl(var(--muted-foreground))]">
					You can leave this page — results will appear here when finished.
				</p>
			</div>
		</div>
	);
}
