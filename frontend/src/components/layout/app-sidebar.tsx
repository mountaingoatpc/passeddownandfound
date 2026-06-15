import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, Tags, User, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface AppSidebarProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const navItems = [
	{ to: "/inventory", label: "Inventory", icon: Package, matchPrefix: true },
	{ to: "/categories", label: "Categories", icon: Tags, matchPrefix: true },
	{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/profile", label: "Profile", icon: User },
] as const;

function isNavItemActive(
	pathname: string,
	to: string,
	matchPrefix?: boolean,
): boolean {
	if (matchPrefix) {
		return pathname === to || pathname.startsWith(`${to}/`);
	}

	return pathname === to;
}

export function AppSidebar({ open, onOpenChange }: AppSidebarProps) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	useEffect(() => {
		if (!open) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onOpenChange(false);
			}
		};

		document.addEventListener("keydown", onKeyDown);
		document.body.style.overflow = "hidden";

		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = "";
		};
	}, [open, onOpenChange]);

	return (
		<>
			<div
				className={cn(
					"fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
					open ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				onClick={() => onOpenChange(false)}
				aria-hidden={!open}
			/>

			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg transition-transform duration-200 ease-out safe-top safe-bottom",
					open ? "translate-x-0" : "-translate-x-full",
				)}
				aria-hidden={!open}
				inert={!open ? true : undefined}
			>
				<div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
					<p className="text-sm font-semibold">Menu</p>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => onOpenChange(false)}
						aria-label="Close menu"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<nav className="flex flex-col gap-1 p-3">
					{navItems.map(({ to, label, icon: Icon, ...item }) => {
						const isActive = isNavItemActive(
							pathname,
							to,
							"matchPrefix" in item ? item.matchPrefix : undefined,
						);
						return (
							<Link
								key={to}
								to={to}
								onClick={() => onOpenChange(false)}
								className={cn(
									"flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-colors",
									isActive
										? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
										: "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
								)}
							>
								<Icon className="h-4 w-4 shrink-0" />
								{label}
							</Link>
						);
					})}
				</nav>
			</aside>
		</>
	);
}
