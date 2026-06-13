import { getConfig } from "@/config";
import { ApiError, fetchApi, getAuthToken } from "./client";

export interface InventoryItem {
	uuid: string;
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
	image_urls: string[];
	ai_evidence: ItemAiEvidence | null;
	owner_uuid: string;
	created_at: string;
	updated_at: string;
}

export interface CreateInventoryItemData {
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
	actual_sale_price?: number | null;
	image_urls?: string[];
	ai_evidence?: ItemAiEvidence | null;
}

export type UpdateInventoryItemData = Partial<CreateInventoryItemData>;

export interface ComparableListing {
	platform: string;
	title: string;
	price: number | null;
	url: string | null;
	notes: string;
}

export interface ItemAiEvidence {
	comparable_listings: ComparableListing[];
	platform_estimates: Record<string, number>;
	confidence?: number | null;
	reasoning?: string;
}

export interface ItemAnalysisResponse {
	name: string;
	category: string;
	description: string;
	condition_suggestion: string;
	projected_sale_price: number;
	starting_bid_suggestion: number;
	platform_estimates: Record<string, number>;
	comparable_listings: ComparableListing[];
	confidence: number;
	reasoning: string;
}

export const inventoryApi = {
	async list(search?: string): Promise<InventoryItem[]> {
		const params = search ? `?search=${encodeURIComponent(search)}` : "";
		return fetchApi<InventoryItem[]>(`/inventory${params}`);
	},

	async get(uuid: string): Promise<InventoryItem> {
		return fetchApi<InventoryItem>(`/inventory/${uuid}`);
	},

	async create(data: CreateInventoryItemData): Promise<InventoryItem> {
		return fetchApi<InventoryItem>("/inventory", {
			method: "POST",
			body: JSON.stringify(data),
		});
	},

	async update(
		uuid: string,
		data: UpdateInventoryItemData,
	): Promise<InventoryItem> {
		return fetchApi<InventoryItem>(`/inventory/${uuid}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	},

	async uploadImage(file: File): Promise<{ image_url: string }> {
		const formData = new FormData();
		formData.append("file", file);
		return fetchApi<{ image_url: string }>("/uploads", {
			method: "POST",
			body: formData,
		});
	},

	async analyzeImage(
		file: File,
		additionalContext?: string,
	): Promise<ItemAnalysisResponse> {
		const formData = new FormData();
		formData.append("file", file);
		if (additionalContext?.trim()) {
			formData.append("additional_context", additionalContext.trim());
		}
		return fetchApi<ItemAnalysisResponse>("/inventory/analyze", {
			method: "POST",
			body: formData,
		});
	},

	async analyzeImageStream(
		file: File,
		additionalContext: string,
		onStatus: (message: string) => void,
	): Promise<ItemAnalysisResponse> {
		const { apiBaseUrl } = getConfig();
		const token = getAuthToken();
		const formData = new FormData();
		formData.append("file", file);
		if (additionalContext.trim()) {
			formData.append("additional_context", additionalContext.trim());
		}

		const headers: Record<string, string> = {};
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		let response: Response;
		try {
			response = await fetch(`${apiBaseUrl}/inventory/analyze/stream`, {
				method: "POST",
				body: formData,
				headers,
			});
		} catch {
			throw new ApiError(0, "Network Error", "Could not reach the API.");
		}

		if (response.status === 401) {
			window.location.href = "/login";
			throw new ApiError(response.status, response.statusText, "Unauthorized");
		}

		if (!response.ok) {
			let message: string | undefined;
			try {
				const err = await response.json();
				message = err.detail ?? err.error;
			} catch {
				// ignore
			}
			throw new ApiError(response.status, response.statusText, message);
		}

		if (!response.body) {
			throw new ApiError(
				response.status,
				response.statusText,
				"Empty response body",
			);
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let result: ItemAnalysisResponse | null = null;

		const processEvent = (eventType: string, data: string) => {
			if (!data) return;
			const payload = JSON.parse(data) as {
				message?: string;
				data?: ItemAnalysisResponse;
			};

			if (eventType === "status" && payload.message) {
				onStatus(payload.message);
			} else if (eventType === "result" && payload.data) {
				result = payload.data;
			} else if (eventType === "error") {
				throw new ApiError(
					response.status,
					response.statusText,
					payload.message ?? "AI analysis failed",
				);
			}
		};

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const chunks = buffer.split("\n\n");
			buffer = chunks.pop() ?? "";

			for (const chunk of chunks) {
				const lines = chunk.split("\n");
				let eventType = "message";
				let data = "";

				for (const line of lines) {
					if (line.startsWith("event:")) {
						eventType = line.slice(6).trim();
					} else if (line.startsWith("data:")) {
						data += line.slice(5).trim();
					}
				}

				processEvent(eventType, data);
			}
		}

		if (buffer.trim()) {
			const lines = buffer.split("\n");
			let eventType = "message";
			let data = "";
			for (const line of lines) {
				if (line.startsWith("event:")) {
					eventType = line.slice(6).trim();
				} else if (line.startsWith("data:")) {
					data += line.slice(5).trim();
				}
			}
			if (data) {
				processEvent(eventType, data);
			}
		}

		if (!result) {
			throw new ApiError(
				response.status,
				response.statusText,
				"AI analysis did not return a result",
			);
		}

		return result;
	},
};
