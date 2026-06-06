import { getConfig } from "@/config";

const AUTH_TOKEN_KEY = "passeddownandfound_token";

export class ApiError extends Error {
	status: number;
	statusText: string;

	constructor(status: number, statusText: string, message?: string) {
		super(message || `API Error: ${status} ${statusText}`);
		this.status = status;
		this.statusText = statusText;
	}
}

export function getAuthToken(): string | null {
	return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
	localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeAuthToken(): void {
	localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function fetchApi<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const { apiBaseUrl } = getConfig();
	const token = getAuthToken();

	const headers: Record<string, string> = {
		...(options.headers as Record<string, string>),
	};

	const isFormData = options.body instanceof FormData;
	if (!isFormData) {
		headers["Content-Type"] = "application/json";
	}

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(`${apiBaseUrl}${endpoint}`, {
		...options,
		headers,
	});

	if (response.status === 401) {
		removeAuthToken();
		window.location.href = "/login";
		throw new ApiError(response.status, response.statusText, "Unauthorized");
	}

	if (!response.ok) {
		let message: string | undefined;
		try {
			const err = await response.json();
			message = err.detail ?? err.error;
		} catch {
			// ignore parse errors
		}
		throw new ApiError(response.status, response.statusText, message);
	}

	const text = await response.text();
	return text ? (JSON.parse(text) as T) : ({} as T);
}
