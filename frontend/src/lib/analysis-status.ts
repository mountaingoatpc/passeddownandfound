import type { AnalysisStatus } from "@/api/inventory";

export function isAnalysisInProgress(status: AnalysisStatus): boolean {
	return status === "queued" || status === "running";
}
