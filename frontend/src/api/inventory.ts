import { fetchApi } from "./client";

export interface InventoryItem {
	uuid: string;
	name: string;
	description: string;
	cost: number;
	projected_sale_price: number;
	actual_sale_price: number | null;
	image_url: string | null;
	owner_uuid: string;
	created_at: string;
	updated_at: string;
}

export interface CreateInventoryItemData {
	name: string;
	description: string;
	cost: number;
	projected_sale_price: number;
	actual_sale_price?: number | null;
	image_url?: string | null;
}

export const inventoryApi = {
	async list(search?: string): Promise<InventoryItem[]> {
		const params = search ? `?search=${encodeURIComponent(search)}` : "";
		return fetchApi<InventoryItem[]>(`/inventory${params}`);
	},

	async create(data: CreateInventoryItemData): Promise<InventoryItem> {
		return fetchApi<InventoryItem>("/inventory", {
			method: "POST",
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
};
