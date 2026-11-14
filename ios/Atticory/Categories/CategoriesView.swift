import SwiftUI

struct CategoriesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = CategoriesViewModel()
    @State private var showCreate = false
    @State private var editing: Category?

    var body: some View {
        Group {
            if viewModel.categories.isEmpty && !viewModel.isLoading {
                ContentUnavailableView {
                    Label("No categories", systemImage: "folder")
                } description: {
                    Text("Create categories before running AI analysis.")
                } actions: {
                    Button("Add category") { showCreate = true }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    ForEach(viewModel.categories) { category in
                        Button {
                            editing = category
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(category.name)
                                    .font(.headline)
                                    .foregroundStyle(AppTheme.foreground)
                                if !category.description.isEmpty {
                                    Text(category.description)
                                        .font(.subheadline)
                                        .foregroundStyle(AppTheme.mutedForeground)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .listRowBackground(AppTheme.card)
                    }
                    .onDelete { indexSet in
                        Task { await viewModel.delete(at: indexSet) }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .appScreenBackground()
        .navigationTitle("Categories")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .sheet(isPresented: $showCreate) {
            CategoryEditorSheet(title: "New category", name: "", description: "") { name, description in
                await viewModel.create(name: name, description: description)
            }
        }
        .sheet(item: $editing) { category in
            CategoryEditorSheet(
                title: "Edit category",
                name: category.name,
                description: category.description
            ) { name, description in
                await viewModel.update(category, name: name, description: description)
            }
        }
        .alert("Error", isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .onChange(of: viewModel.didUnauthorized) { _, unauthorized in
            if unauthorized {
                Task { await session.handleUnauthorized() }
            }
        }
    }
}

private struct CategoryEditorSheet: View {
    let title: String
    @State var name: String
    @State var description: String
    let onSave: (String, String) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Description", text: $description, axis: .vertical)
                    .lineLimit(3 ... 5)
                if let errorMessage {
                    ErrorBanner(message: errorMessage)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") {
                        Task {
                            isSaving = true
                            defer { isSaving = false }
                            if await onSave(name, description) {
                                dismiss()
                            } else {
                                errorMessage = "Could not save category."
                            }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

@MainActor
final class CategoriesViewModel: ObservableObject {
    @Published var categories: [Category] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var didUnauthorized = false

    private let client = APIClient.shared

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            categories = try await client.listCategories()
        } catch let error as APIError {
            if error == .unauthorized {
                didUnauthorized = true
            } else {
                errorMessage = error.message
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func create(name: String, description: String) async -> Bool {
        do {
            let created = try await client.createCategory(
                CreateCategoryRequest(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    description: description
                )
            )
            categories.insert(created, at: 0)
            return true
        } catch let error as APIError {
            if error == .unauthorized { didUnauthorized = true }
            errorMessage = error.message
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func update(_ category: Category, name: String, description: String) async -> Bool {
        do {
            let updated = try await client.updateCategory(
                uuid: category.uuid,
                UpdateCategoryRequest(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    description: description
                )
            )
            if let index = categories.firstIndex(where: { $0.uuid == category.uuid }) {
                categories[index] = updated
            }
            return true
        } catch let error as APIError {
            if error == .unauthorized { didUnauthorized = true }
            errorMessage = error.message
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func delete(at offsets: IndexSet) async {
        for index in offsets {
            let category = categories[index]
            do {
                try await client.deleteCategory(uuid: category.uuid)
                categories.remove(at: index)
            } catch let error as APIError {
                if error == .unauthorized { didUnauthorized = true }
                errorMessage = error.message
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
