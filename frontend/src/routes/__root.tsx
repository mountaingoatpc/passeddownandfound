import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
	component: () => (
		<div className="min-h-dvh bg-[hsl(var(--background))]">
			<Outlet />
		</div>
	),
});
