import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const { login, register, isAuthenticated, isLoading } = useAuth();
	const navigate = useNavigate();
	const [mode, setMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!isLoading && isAuthenticated) {
			navigate({ to: "/inventory" });
		}
	}, [isLoading, isAuthenticated, navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSubmitting(true);

		const result =
			mode === "login"
				? await login(email, password)
				: await register(email, password);
		setSubmitting(false);

		if (result.error) {
			setError(result.error);
			return;
		}

		navigate({ to: "/inventory" });
	};

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center px-4 safe-top safe-bottom">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold tracking-tight">
						Passed Down and Found
					</h1>
					<p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
						Inventory for treasured finds
					</p>
				</div>

				<form
					onSubmit={handleSubmit}
					className="space-y-4 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm"
				>
					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium">
							Email
						</label>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							inputMode="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="password" className="text-sm font-medium">
							Password
						</label>
						<Input
							id="password"
							type="password"
							autoComplete={
								mode === "login" ? "current-password" : "new-password"
							}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							minLength={6}
						/>
					</div>

					{error && (
						<p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
					)}

					<Button type="submit" className="w-full" disabled={submitting}>
						{submitting
							? "Please wait..."
							: mode === "login"
								? "Sign In"
								: "Create Account"}
					</Button>

					<button
						type="button"
						className="w-full text-center text-sm text-[hsl(var(--primary))] hover:underline"
						onClick={() => {
							setMode(mode === "login" ? "register" : "login");
							setError(null);
						}}
					>
						{mode === "login"
							? "Need an account? Register"
							: "Already have an account? Sign in"}
					</button>
				</form>
			</div>
		</div>
	);
}
