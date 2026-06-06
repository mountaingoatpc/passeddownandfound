import { fetchApi, removeAuthToken, setAuthToken } from "./client";

export interface User {
	uuid: string;
	email: string;
}

interface AuthResponse {
	token: string;
	user: User;
}

export const authApi = {
	async login(email: string, password: string): Promise<AuthResponse> {
		const res = await fetchApi<AuthResponse>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		});
		setAuthToken(res.token);
		return res;
	},

	async register(email: string, password: string): Promise<AuthResponse> {
		const res = await fetchApi<AuthResponse>("/auth/register", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		});
		setAuthToken(res.token);
		return res;
	},

	async getMe(): Promise<User> {
		return fetchApi<User>("/auth/me");
	},

	logout(): void {
		removeAuthToken();
	},
};
