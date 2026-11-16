import SwiftUI

struct InventoryDetailView: View {
    let itemId: String

    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: InventoryDetailViewModel
    @State private var showEdit = false
    @State private var showDeleteConfirm = false

    init(itemId: String) {
        self.itemId = itemId
        _viewModel = StateObject(wrappedValue: InventoryDetailViewModel(itemId: itemId))
    }

    var body: some View {
        Group {
            if let item = viewModel.item {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        photoStrip(item.imageUrls)

                        VStack(alignment: .leading, spacing: 8) {
                            Text(item.name)
                                .font(AppTheme.headlineFont)
                            AnalysisStatusBadge(status: item.analysisStatus)
                            if let error = item.analysisError, item.analysisStatus == .failed {
                                ErrorBanner(message: error)
                            }
                        }

                        metricsGrid(item)
                        detailsSection(item)

                        if let evidence = item.aiEvidence {
                            evidenceSection(evidence)
                        }

                        if item.analysisStatus.isInProgress {
                            HStack(spacing: 10) {
                                ProgressView()
                                Text("AI analysis in progress…")
                                    .font(.subheadline)
                                    .foregroundStyle(AppTheme.mutedForeground)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppTheme.primary.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }

                        Button {
                            Task { await viewModel.reanalyze() }
                        } label: {
                            Label(
                                item.analysisStatus.isInProgress ? "Analysis running…" : "Re-analyze with AI",
                                systemImage: "sparkles"
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(item.imageUrls.isEmpty || item.analysisStatus.isInProgress || viewModel.isWorking)
                    }
                    .padding(20)
                }
            } else if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.errorMessage {
                ContentUnavailableView("Couldn't load item", systemImage: "exclamationmark.triangle", description: Text(error))
            }
        }
        .appScreenBackground()
        .navigationTitle("Item")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Edit") { showEdit = true }
                    Button("Delete", role: .destructive) { showDeleteConfirm = true }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showEdit) {
            if let item = viewModel.item {
                NavigationStack {
                    ItemEditorView(mode: .edit(item)) {
                        showEdit = false
                        Task { await viewModel.load() }
                    }
                }
            }
        }
        .confirmationDialog("Delete this item?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    if await viewModel.delete() {
                        dismiss()
                    }
                }
            }
        }
        .task {
            await viewModel.load()
        }
        .onChange(of: viewModel.didUnauthorized) { _, unauthorized in
            if unauthorized {
                Task { await session.handleUnauthorized() }
            }
        }
        .alert("Error", isPresented: Binding(
            get: { viewModel.alertMessage != nil },
            set: { if !$0 { viewModel.alertMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.alertMessage ?? "")
        }
    }

    @ViewBuilder
    private func photoStrip(_ urls: [String]) -> some View {
        if urls.isEmpty {
            RemoteImage(path: nil)
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        } else {
            TabView {
                ForEach(urls, id: \.self) { url in
                    RemoteImage(path: url)
                }
            }
            .frame(height: 260)
            .tabViewStyle(.page(indexDisplayMode: urls.count > 1 ? .automatic : .never))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private func metricsGrid(_ item: InventoryItem) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            metric("Cost", MoneyFormat.string(item.cost))
            metric("Projected", MoneyFormat.string(item.projectedSalePrice))
            metric("Starting bid", MoneyFormat.string(item.startingBid))
            metric(
                "Actual sale",
                item.actualSalePrice.map(MoneyFormat.string) ?? "—"
            )
            if item.partialSale, let unitsSold = item.unitsSold {
                metric("Units sold", "\(unitsSold) of \(item.quantity)")
            }
            if let paymentMethod = item.paymentMethod {
                metric("Payment", paymentMethod.label)
            }
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(AppTheme.mutedForeground)
            Text(value)
                .font(.headline)
                .foregroundStyle(AppTheme.foreground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(AppTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }

    private func detailsSection(_ item: InventoryItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            detailRow("Category", item.category.isEmpty ? "—" : item.category)
            detailRow("Condition", ParsedCondition.parse(item.condition).displayLabel)
            detailRow("Quantity", "\(item.quantity)")
            detailRow("Weight", "\(item.weightPounds) lb \(String(format: "%.1f", item.weightOunces)) oz")
            if !item.description.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Description")
                        .font(.caption)
                        .foregroundStyle(AppTheme.mutedForeground)
                    Text(item.description)
                        .font(.body)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }

    private func detailRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(AppTheme.mutedForeground)
            Spacer()
            Text(value)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }

    private func evidenceSection(_ evidence: ItemAiEvidence) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AI evidence")
                .font(.headline)

            if let confidence = evidence.confidence {
                Text("Confidence \(Int((confidence * 100).rounded()))%")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.mutedForeground)
            }

            if !evidence.reasoning.isEmpty {
                Text(evidence.reasoning)
                    .font(.subheadline)
            }

            if !evidence.platformEstimates.isEmpty {
                ForEach(evidence.platformEstimates.keys.sorted(), id: \.self) { key in
                    HStack {
                        Text(key)
                        Spacer()
                        Text(MoneyFormat.string(evidence.platformEstimates[key] ?? 0))
                    }
                    .font(.subheadline)
                }
            }

            ForEach(evidence.comparableListings) { listing in
                VStack(alignment: .leading, spacing: 4) {
                    Text(listing.title)
                        .font(.subheadline.weight(.medium))
                    HStack {
                        Text(listing.platform)
                        if let price = listing.price {
                            Text(MoneyFormat.string(price))
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(AppTheme.mutedForeground)
                }
                .padding(.vertical, 4)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }
}

@MainActor
final class InventoryDetailViewModel: ObservableObject {
    @Published var item: InventoryItem?
    @Published var isLoading = false
    @Published var isWorking = false
    @Published var errorMessage: String?
    @Published var alertMessage: String?
    @Published var didUnauthorized = false

    private let itemId: String
    private let client = APIClient.shared
    private var pollTask: Task<Void, Never>?

    init(itemId: String) {
        self.itemId = itemId
    }

    deinit {
        pollTask?.cancel()
    }

    func load() async {
        isLoading = item == nil
        defer { isLoading = false }

        do {
            item = try await client.getInventoryItem(uuid: itemId)
            startPollingIfNeeded()
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

    func reanalyze() async {
        isWorking = true
        defer { isWorking = false }
        do {
            item = try await client.queueAnalysis(uuid: itemId, context: nil)
            startPollingIfNeeded()
        } catch let error as APIError {
            if error == .unauthorized {
                didUnauthorized = true
            } else {
                alertMessage = error.message
            }
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    func delete() async -> Bool {
        do {
            try await client.deleteInventoryItem(uuid: itemId)
            return true
        } catch let error as APIError {
            if error == .unauthorized {
                didUnauthorized = true
            } else {
                alertMessage = error.message
            }
            return false
        } catch {
            alertMessage = error.localizedDescription
            return false
        }
    }

    private func startPollingIfNeeded() {
        pollTask?.cancel()
        guard item?.analysisStatus.isInProgress == true else { return }

        pollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                guard !Task.isCancelled else { return }
                do {
                    let latest = try await client.getInventoryItem(uuid: itemId)
                    item = latest
                    if !latest.analysisStatus.isInProgress {
                        return
                    }
                } catch {
                    return
                }
            }
        }
    }
}
