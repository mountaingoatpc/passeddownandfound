import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { authApi, type User } from "@/api/auth";
import { getAuthToken } from "@/api/client";

interface AuthContextType {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (email: string, password: string) => Promise<{ error?: string }>;
	register: (email: string, password: string) => Promise<{ error?: string }>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const token = getAuthToken();
		if (!token) {
			setIsLoading(false);
			return;
		}
		authApi
			.getMe()
			.then((u) => setUser(u))
			.catch(() => authApi.logout())
			.finally(() => setIsLoading(false));
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		try {
			const res = await authApi.login(email, password);
			setUser(res.user);
			return {};
		} catch (err) {
			return { error: err instanceof Error ? err.message : "Login failed" };
		}
	}, []);

	const register = useCallback(async (email: string, password: string) => {
		try {
			const res = await authApi.register(email, password);
			setUser(res.user);
			return {};
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Registration failed",
			};
		}
	}, []);

	const logout = useCallback(() => {
		authApi.logout();
		setUser(null);
	}, []);

	return (
		<AuthContext.Provider
			value={{
				user,
				isAuthenticated: !!user,
				isLoading,
				login,
				register,
				logout,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
	return ctx;
}
