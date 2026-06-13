import { Camera, ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ImageSlot {
	url: string;
	file?: File;
}

interface MultiImageCaptureProps {
	images: ImageSlot[];
	onChange: (images: ImageSlot[]) => void;
	maxImages?: number;
	disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateImageFile(file: File): string | null {
	if (!file.type.startsWith("image/")) {
		return "Please choose an image file.";
	}
	if (file.size > MAX_FILE_SIZE) {
		return "Image must be under 10MB.";
	}
	return null;
}

export function MultiImageCapture({
	images,
	onChange,
	maxImages = 4,
	disabled,
}: MultiImageCaptureProps) {
	const cameraInputRef = useRef<HTMLInputElement>(null);
	const galleryInputRef = useRef<HTMLInputElement>(null);
	const [error, setError] = useState<string | null>(null);

	const remainingSlots = maxImages - images.length;
	const atMax = remainingSlots <= 0;

	const addFiles = (fileList: FileList | null) => {
		if (!fileList?.length || atMax) return;

		const newSlots: ImageSlot[] = [];
		const limit = Math.min(fileList.length, remainingSlots);

		for (let i = 0; i < limit; i++) {
			const file = fileList[i];
			const validationError = validateImageFile(file);
			if (validationError) {
				setError(validationError);
				return;
			}
			newSlots.push({
				url: URL.createObjectURL(file),
				file,
			});
		}

		setError(null);
		onChange([...images, ...newSlots]);
	};

	const removeImage = (index: number) => {
		const slot = images[index];
		if (slot.url.startsWith("blob:")) {
			URL.revokeObjectURL(slot.url);
		}
		onChange(images.filter((_, i) => i !== index));
		setError(null);
	};

	return (
		<div className="space-y-3">
			{images.length > 0 && (
				<div className="grid grid-cols-2 gap-2">
					{images.map((slot, index) => (
						<div
							key={slot.url}
							className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40"
						>
							<img
								src={slot.url}
								alt={`Item photo ${index + 1}`}
								className="h-full w-full object-cover"
							/>
							<Button
								type="button"
								variant="destructive"
								size="icon"
								className="absolute right-1 top-1 h-7 w-7"
								onClick={() => removeImage(index)}
								disabled={disabled}
								aria-label={`Remove photo ${index + 1}`}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
					))}
				</div>
			)}

			{!atMax && images.length === 0 && (
				<div
					className={cn(
						"flex aspect-[4/3] flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-6",
					)}
				>
					<Camera className="mx-auto mb-2 h-10 w-10 text-[hsl(var(--muted-foreground))]" />
					<p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
						Take photos or choose from your gallery
					</p>
				</div>
			)}

			<input
				ref={cameraInputRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="hidden"
				onChange={(e) => {
					addFiles(e.target.files);
					e.target.value = "";
				}}
			/>
			<input
				ref={galleryInputRef}
				type="file"
				accept="image/*"
				multiple
				className="hidden"
				onChange={(e) => {
					addFiles(e.target.files);
					e.target.value = "";
				}}
			/>

			<div className="grid grid-cols-2 gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => cameraInputRef.current?.click()}
					disabled={disabled || atMax}
					className="w-full"
				>
					<Camera className="h-4 w-4" />
					Take Photo
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => galleryInputRef.current?.click()}
					disabled={disabled || atMax}
					className="w-full"
				>
					<ImagePlus className="h-4 w-4" />
					Gallery
				</Button>
			</div>

			{atMax && (
				<p className="text-sm text-[hsl(var(--muted-foreground))]">
					Maximum {maxImages} photos
				</p>
			)}

			{error && (
				<p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
			)}
		</div>
	);
}
