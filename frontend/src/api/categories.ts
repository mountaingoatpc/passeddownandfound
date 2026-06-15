import { fetchApi } from "./client";

export interface Category {
	uuid: string;
	name: string;
	description: string;
	owner_uuid: string;
	created_at: string;
	updated_at: string;
}

export interface CreateCategoryData {
	name: string;
	description: string;
}

export type UpdateCategoryData = Partial<CreateCategoryData>;

export const categoriesApi = {
	async list(): Promise<Category[]> {
		return fetchApi<Category[]>("/categories");
	},

	async create(data: CreateCategoryData): Promise<Category> {
		return fetchApi<Category>("/categories", {
			method: "POST",
			body: JSON.stringify(data),
		});
	},

	async update(uuid: string, data: UpdateCategoryData): Promise<Category> {
		return fetchApi<Category>(`/categories/${uuid}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	},

	async remove(uuid: string): Promise<void> {
		await fetchApi<void>(`/categories/${uuid}`, {
			method: "DELETE",
		});
	},
};
