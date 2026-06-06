import { Camera, ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface CameraCaptureProps {
	previewUrl: string | null;
	onCapture: (file: File) => void;
	onClear: () => void;
	disabled?: boolean;
}

export function CameraCapture({
	previewUrl,
	onCapture,
	onClear,
	disabled,
}: CameraCaptureProps) {
	const cameraInputRef = useRef<HTMLInputElement>(null);
	const galleryInputRef = useRef<HTMLInputElement>(null);
	const [error, setError] = useState<string | null>(null);

	const handleFile = (fileList: FileList | null) => {
		const file = fileList?.[0];
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			setError("Please choose an image file.");
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			setError("Image must be under 10MB.");
			return;
		}

		setError(null);
		onCapture(file);
	};

	return (
		<div className="space-y-3">
			<div
				className={cn(
					"relative overflow-hidden rounded-[var(--radius)] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40",
					previewUrl
						? "aspect-[4/3]"
						: "aspect-[4/3] flex flex-col items-center justify-center p-6",
				)}
			>
				{previewUrl ? (
					<>
						<img
							src={previewUrl}
							alt="Item preview"
							className="h-full w-full object-cover"
						/>
						<Button
							type="button"
							variant="destructive"
							size="icon"
							className="absolute right-2 top-2"
							onClick={onClear}
							disabled={disabled}
							aria-label="Remove photo"
						>
							<X className="h-4 w-4" />
						</Button>
					</>
				) : (
					<div className="text-center">
						<Camera className="mx-auto mb-2 h-10 w-10 text-[hsl(var(--muted-foreground))]" />
						<p className="text-sm text-[hsl(var(--muted-foreground))]">
							Take a photo or choose from your gallery
						</p>
					</div>
				)}
			</div>

			<input
				ref={cameraInputRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="hidden"
				onChange={(e) => handleFile(e.target.files)}
			/>
			<input
				ref={galleryInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(e) => handleFile(e.target.files)}
			/>

			<div className="grid grid-cols-2 gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => cameraInputRef.current?.click()}
					disabled={disabled}
					className="w-full"
				>
					<Camera className="h-4 w-4" />
					Take Photo
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => galleryInputRef.current?.click()}
					disabled={disabled}
					className="w-full"
				>
					<ImagePlus className="h-4 w-4" />
					Gallery
				</Button>
			</div>

			{error && (
				<p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
			)}
		</div>
	);
}
