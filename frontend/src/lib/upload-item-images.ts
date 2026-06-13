import { inventoryApi } from "@/api/inventory";
import type { ItemFormImage } from "@/components/inventory/item-form";

export async function resolveItemImageUrls(
	images: ItemFormImage[],
): Promise<string[]> {
	const urls: string[] = [];

	for (const image of images) {
		if (image.file) {
			const upload = await inventoryApi.uploadImage(image.file);
			urls.push(upload.image_url);
		} else if (image.serverPath) {
			urls.push(image.serverPath);
		}
	}

	return urls;
}
