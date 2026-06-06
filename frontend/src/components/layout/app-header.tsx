import { Link } from "@tanstack/react-router";
import { LogOut, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface AppHeaderProps {
	title: string;
	action?: React.ReactNode;
}

export function AppHeader({ title, action }: AppHeaderProps) {
	const { user, logout } = useAuth();

	return (
		<header className="sticky top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--card))]/80">
			<div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 safe-top">
				<div className="flex min-w-0 items-center gap-2">
					<Package className="h-5 w-5 shrink-0 text-[hsl(var(--primary))]" />
					<div className="min-w-0">
						<p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
							Passed Down and Found
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
