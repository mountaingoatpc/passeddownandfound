export interface AppConfig {
	apiBaseUrl: string;
}

declare global {
	interface Window {
		__RUNTIME_CONFIG__?: {
			apiBaseUrl?: string;
		};
	}
}

export function getConfig(): AppConfig {
	const runtimeUrl = window.__RUNTIME_CONFIG__?.apiBaseUrl;
	return {
		apiBaseUrl: runtimeUrl || import.meta.env.VITE_API_URL || "/api",
	};
}

export function resolveImageUrl(
	imageUrl: string | null | undefined,
): string | null {
	if (!imageUrl) return null;
	if (imageUrl.startsWith("http")) return imageUrl;
	const { apiBaseUrl } = getConfig();
	const base = apiBaseUrl.replace(/\/$/, "");
	return `${base}${imageUrl}`;
}
