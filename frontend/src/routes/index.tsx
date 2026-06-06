import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

function IndexPage() {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) {
		return (
			<div className="flex min-h-dvh items-center justify-center">
				<p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
			</div>
		);
	}

	return <Navigate to={isAuthenticated ? "/inventory" : "/login"} />;
}
