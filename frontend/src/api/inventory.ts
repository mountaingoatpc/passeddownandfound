import { fetchApi } from "./client";

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
	image_url: string | null;
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
	image_url?: string | null;
}

export type UpdateInventoryItemData = Partial<CreateInventoryItemData>;

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

	async update(uuid: string, data: UpdateInventoryItemData): Promise<InventoryItem> {
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
};
