import {
	fetchApi,
	removeAuthToken,
	setAuthToken,
	setRefreshToken,
} from "./client";

export interface User {
	uuid: string;
	email: string;
}

interface AuthResponse {
	token: string;
	refresh_token?: string;
	user: User;
}

function persistAuth(res: AuthResponse): AuthResponse {
	setAuthToken(res.token);
	if (res.refresh_token) {
		setRefreshToken(res.refresh_token);
	}
	return res;
}

export const authApi = {
	async login(email: string, password: string): Promise<AuthResponse> {
		const res = await fetchApi<AuthResponse>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		});
		return persistAuth(res);
	},

	async register(email: string, password: string): Promise<AuthResponse> {
		const res = await fetchApi<AuthResponse>("/auth/register", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		});
		return persistAuth(res);
	},

	async getMe(): Promise<User> {
		return fetchApi<User>("/auth/me");
	},

	logout(): void {
		removeAuthToken();
	},
};
