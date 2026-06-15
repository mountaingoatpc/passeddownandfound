import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { type Category, categoriesApi } from "@/api/categories";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/categories/")({
	component: CategoriesPage,
});

interface CategoryFormValues {
	name: string;
	description: string;
}

function CategoryForm({
	initialValues,
	submitLabel,
	onSubmit,
	onCancel,
	isPending,
	error,
}: {
	initialValues?: CategoryFormValues;
	submitLabel: string;
	onSubmit: (values: CategoryFormValues) => void;
	onCancel?: () => void;
	isPending?: boolean;
	error?: string | null;
}) {
	const [name, setName] = useState(initialValues?.name ?? "");
	const [description, setDescription] = useState(
		initialValues?.description ?? "",
	);

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		onSubmit({ name: name.trim(), description: description.trim() });
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<label htmlFor="category-name" className="text-sm font-medium">
					Name
				</label>
				<Input
					id="category-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Furniture, Jewelry, Glassware..."
					required
				/>
			</div>

			<div className="space-y-2">
				<label htmlFor="category-description" className="text-sm font-medium">
					Description
				</label>
				<Textarea
					id="category-description"
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					placeholder="What kinds of items belong in this category?"
					rows={3}
				/>
			</div>

			{error && (
				<p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
			)}

			<div className="flex gap-2">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
				)}
				<Button type="submit" disabled={isPending || !name.trim()}>
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}

function CategoryRow({
	category,
	onEdit,
	onDelete,
	isDeleting,
}: {
	category: Category;
	onEdit: () => void;
	onDelete: () => void;
	isDeleting: boolean;
}) {
	return (
		<div className="flex items-start justify-between gap-3 border-b border-[hsl(var(--border))] px-4 py-4 last:border-0">
			<div className="min-w-0">
				<p className="font-medium">{category.name}</p>
				{category.description && (
					<p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
						{category.description}
					</p>
				)}
			</div>
			<div className="flex shrink-0 gap-1">
				<Button
					variant="ghost"
					size="icon"
					onClick={onEdit}
					aria-label="Edit category"
				>
					<Pencil className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={onDelete}
					disabled={isDeleting}
					aria-label="Delete category"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

function CategoriesPage() {
	const queryClient = useQueryClient();
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	const {
		data: categories = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["categories"],
		queryFn: () => categoriesApi.list(),
	});

	const invalidateCategories = async () => {
		await queryClient.invalidateQueries({ queryKey: ["categories"] });
	};

	const createMutation = useMutation({
		mutationFn: categoriesApi.create,
		onSuccess: async () => {
			setFormError(null);
			setShowCreateForm(false);
			await invalidateCategories();
		},
		onError: (err) => {
			setFormError(
				err instanceof Error ? err.message : "Failed to create category",
			);
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({
			uuid,
			values,
		}: {
			uuid: string;
			values: CategoryFormValues;
		}) => categoriesApi.update(uuid, values),
		onSuccess: async () => {
			setFormError(null);
			setEditingCategory(null);
			await invalidateCategories();
		},
		onError: (err) => {
			setFormError(
				err instanceof Error ? err.message : "Failed to update category",
			);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: categoriesApi.remove,
		onSuccess: invalidateCategories,
	});

	return (
		<div className="min-h-dvh">
			<AppHeader
				title="Categories"
				action={
					!showCreateForm &&
					!editingCategory && (
						<Button size="sm" onClick={() => setShowCreateForm(true)}>
							<Plus className="h-4 w-4" />
							<span className="hidden sm:inline">Add Category</span>
							<span className="sm:hidden">Add</span>
						</Button>
					)
				}
			/>

			<main className="mx-auto max-w-3xl space-y-6 px-4 py-4 safe-bottom">
				<div>
					<h2 className="text-lg font-semibold">Your Categories</h2>
					<p className="text-sm text-[hsl(var(--muted-foreground))]">
						Create categories for your inventory. AI analysis will choose from
						this list when labeling items.
					</p>
				</div>

				{(showCreateForm || editingCategory) && (
					<div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
						<div className="mb-4 flex items-center justify-between gap-3">
							<h3 className="font-semibold">
								{editingCategory ? "Edit Category" : "New Category"}
							</h3>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => {
									setShowCreateForm(false);
									setEditingCategory(null);
									setFormError(null);
								}}
								aria-label="Close form"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>

						<CategoryForm
							key={editingCategory?.uuid ?? "create"}
							initialValues={
								editingCategory
									? {
											name: editingCategory.name,
											description: editingCategory.description,
										}
									: undefined
							}
							submitLabel={editingCategory ? "Save Changes" : "Create Category"}
							isPending={createMutation.isPending || updateMutation.isPending}
							error={formError}
							onCancel={() => {
								setShowCreateForm(false);
								setEditingCategory(null);
								setFormError(null);
							}}
							onSubmit={(values) => {
								setFormError(null);
								if (editingCategory) {
									updateMutation.mutate({
										uuid: editingCategory.uuid,
										values,
									});
									return;
								}
								createMutation.mutate(values);
							}}
						/>
					</div>
				)}

				{isLoading && (
					<p className="text-sm text-[hsl(var(--muted-foreground))]">
						Loading categories...
					</p>
				)}

				{error && (
					<p className="text-sm text-[hsl(var(--destructive))]">
						{error instanceof Error
							? error.message
							: "Failed to load categories"}
					</p>
				)}

				{!isLoading && !error && categories.length === 0 && !showCreateForm && (
					<div className="rounded-[var(--radius)] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
						<p className="text-[hsl(var(--muted-foreground))]">
							No categories yet. Add your first category to organize inventory
							and enable AI category suggestions.
						</p>
						<Button className="mt-4" onClick={() => setShowCreateForm(true)}>
							<Plus className="h-4 w-4" />
							Add Category
						</Button>
					</div>
				)}

				{categories.length > 0 && !editingCategory && (
					<div className="overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
						{categories.map((category) => (
							<CategoryRow
								key={category.uuid}
								category={category}
								onEdit={() => {
									setShowCreateForm(false);
									setEditingCategory(category);
									setFormError(null);
								}}
								onDelete={() => {
									if (
										window.confirm(
											`Delete "${category.name}"? Existing inventory items will keep this label.`,
										)
									) {
										deleteMutation.mutate(category.uuid);
									}
								}}
								isDeleting={deleteMutation.isPending}
							/>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
