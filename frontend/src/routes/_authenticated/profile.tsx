import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	const { user } = useAuth();

	return (
		<div className="min-h-dvh">
			<AppHeader title="Profile" />

			<main className="mx-auto max-w-6xl space-y-6 px-4 py-4 safe-bottom">
				<div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
					<h2 className="text-lg font-semibold">Account</h2>
					<dl className="mt-4 space-y-4">
						<div>
							<dt className="text-sm text-[hsl(var(--muted-foreground))]">
								Email
							</dt>
							<dd className="mt-1 font-medium">{user?.email ?? "—"}</dd>
						</div>
					</dl>
				</div>
			</main>
		</div>
	);
}
