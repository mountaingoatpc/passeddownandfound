import SwiftUI

struct InventoryListView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = InventoryListViewModel()
    @State private var showCreate = false

    var body: some View {
        Group {
            if viewModel.items.isEmpty && !viewModel.isLoading {
                ContentUnavailableView {
                    Label("No items yet", systemImage: "shippingbox")
                } description: {
                    Text("Photograph a find to start your inventory.")
                } actions: {
                    Button("Add item") { showCreate = true }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    ForEach(viewModel.items) { item in
                        NavigationLink(value: item.uuid) {
                            InventoryRowView(item: item)
                        }
                        .listRowBackground(AppTheme.card)
                    }

                    if viewModel.canLoadMore {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                        .listRowBackground(Color.clear)
                        .task {
                            await viewModel.loadMore()
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .appScreenBackground()
        .navigationTitle("Inventory")
        .navigationDestination(for: String.self) { uuid in
            InventoryDetailView(itemId: uuid)
        }
        .searchable(text: $viewModel.searchText, prompt: "Search inventory")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreate = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreate) {
            NavigationStack {
                ItemEditorView(mode: .create) {
                    showCreate = false
                    Task { await viewModel.reload() }
                }
            }
        }
        .refreshable {
            await viewModel.reload()
        }
        .task {
            await viewModel.reload()
        }
        .onChange(of: viewModel.searchText) { _, _ in
            viewModel.scheduleSearch()
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

struct InventoryRowView: View {
    let item: InventoryItemSummary

    var body: some View {
        HStack(spacing: 12) {
            RemoteImage(path: item.imageUrls.first)
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.headline)
                    .foregroundStyle(AppTheme.foreground)
                    .lineLimit(1)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(AppTheme.mutedForeground)
                    .lineLimit(2)
                HStack(spacing: 8) {
                    Text(MoneyFormat.string(item.cost))
                        .font(.caption.weight(.medium))
                    Text("→")
                        .font(.caption)
                        .foregroundStyle(AppTheme.mutedForeground)
                    Text(MoneyFormat.string(item.projectedSalePrice))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(AppTheme.primary)
                    Spacer(minLength: 0)
                    AnalysisStatusBadge(status: item.analysisStatus)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

@MainActor
final class InventoryListViewModel: ObservableObject {
    @Published var items: [InventoryItemSummary] = []
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var didUnauthorized = false

    private var page = 1
    private var totalPages = 1
    private var searchTask: Task<Void, Never>?
    private let client = APIClient.shared

    var canLoadMore: Bool {
        page < totalPages && !isLoading
    }

    func scheduleSearch() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            await reload()
        }
    }

    func reload() async {
        page = 1
        await load(reset: true)
    }

    func loadMore() async {
        guard canLoadMore else { return }
        page += 1
        await load(reset: false)
    }

    private func load(reset: Bool) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await client.listInventory(search: searchText, page: page, limit: 20)
            totalPages = max(response.totalPages, 1)
            if reset {
                items = response.items
            } else {
                let existing = Set(items.map(\.uuid))
                items.append(contentsOf: response.items.filter { !existing.contains($0.uuid) })
            }
        } catch let error as APIError {
            if error == .unauthorized {
                didUnauthorized = true
            } else {
                errorMessage = error.message
            }
            if reset { items = [] }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
