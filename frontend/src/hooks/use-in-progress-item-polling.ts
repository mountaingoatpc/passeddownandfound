import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
	inventoryApi,
	type InventoryItemSummary,
	type InventoryListResponse,
} from "@/api/inventory";
import { isAnalysisInProgress } from "@/lib/analysis-status";

export function useInProgressItemPolling(
	listQueryKey: readonly unknown[],
	items: InventoryItemSummary[],
) {
	const queryClient = useQueryClient();
	const inProgressIds = useMemo(
		() =>
			items
				.filter((item) => isAnalysisInProgress(item.analysis_status))
				.map((item) => item.uuid),
		[items],
	);

	const pollResults = useQueries({
		queries: inProgressIds.map((uuid) => ({
			queryKey: ["inventory", uuid],
			queryFn: () => inventoryApi.get(uuid),
			refetchInterval: 3000,
		})),
	});

	const pollSignature = pollResults
		.map((result) => {
			const item = result.data;
			if (!item) return "";
			return `${item.uuid}:${item.analysis_status}:${item.updated_at}`;
		})
		.join("|");

	useEffect(() => {
		const updates = pollResults
			.map((result) => result.data)
			.filter((item): item is NonNullable<typeof item> => item != null);
		if (updates.length === 0) return;

		queryClient.setQueryData<InventoryListResponse>(
			listQueryKey,
			(current) => {
				if (!current) return current;

				const updatesById = new Map(updates.map((item) => [item.uuid, item]));
				return {
					...current,
					items: current.items.map((item) => {
						const updated = updatesById.get(item.uuid);
						if (!updated) return item;

						return {
							uuid: updated.uuid,
							name: updated.name,
							description: updated.description,
							cost: updated.cost,
							projected_sale_price: updated.projected_sale_price,
							actual_sale_price: updated.actual_sale_price,
							image_urls: updated.image_urls,
							analysis_status: updated.analysis_status,
							analysis_error: updated.analysis_error,
						};
					}),
				};
			},
		);
	}, [pollSignature, pollResults, queryClient, listQueryKey]);
}
