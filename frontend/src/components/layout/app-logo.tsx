interface AppLogoProps {
	size?: "sm" | "md" | "lg";
	className?: string;
}

const sizeClasses = {
	sm: "h-8 w-8",
	md: "h-10 w-10",
	lg: "h-16 w-16",
};

export function AppLogo({ size = "sm", className = "" }: AppLogoProps) {
	return (
		<img
			src="/logo.png"
			alt="atticory"
			className={`${sizeClasses[size]} shrink-0 ${className}`}
		/>
	);
}
