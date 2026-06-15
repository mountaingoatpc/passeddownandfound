import { Link } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { AppLogo } from "@/components/layout/app-logo";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface AppHeaderProps {
	title: string;
	action?: React.ReactNode;
}

export function AppHeader({ title, action }: AppHeaderProps) {
	const { user, logout } = useAuth();
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<>
			<AppSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
			<header className="sticky top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/80">
				<div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 safe-top">
					<div className="flex min-w-0 items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSidebarOpen(true)}
							aria-label="Open menu"
						>
							<Menu className="h-4 w-4" />
						</Button>
						<AppLogo size="sm" />
						<div className="min-w-0">
							<p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
								atticory
							</p>
							<h1 className="truncate text-lg font-semibold">{title}</h1>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{action}
						{user && (
							<Button
								variant="ghost"
								size="icon"
								onClick={logout}
								aria-label="Sign out"
							>
								<LogOut className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</header>
		</>
	);
}

export function BackLink({ to, label }: { to: string; label: string }) {
	return (
		<Link
			to={to}
			className="inline-flex items-center text-sm text-[hsl(var(--primary))] hover:underline"
		>
			← {label}
		</Link>
	);
}
