import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        Group {
            if let metrics = viewModel.metrics {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            metricCard("Items", "\(metrics.totalItems)")
                            metricCard("Sold", "\(metrics.itemsSold)")
                            metricCard("Total cost", MoneyFormat.string(metrics.totalCost))
                            metricCard("Projected sales", MoneyFormat.string(metrics.totalProjectedSale))
                            metricCard("Projected profit", MoneyFormat.string(metrics.projectedProfit))
                            metricCard("Realized profit", MoneyFormat.string(metrics.profit))
                        }

                        if !metrics.byCategory.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("By category")
                                    .font(AppTheme.headlineFont)

                                ForEach(metrics.byCategory) { row in
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text(row.category.isEmpty ? "Uncategorized" : row.category)
                                            .font(.headline)
                                        HStack {
                                            Text("Cost \(MoneyFormat.string(row.cost))")
                                            Spacer()
                                            Text("Proj. \(MoneyFormat.string(row.projectedSale))")
                                        }
                                        .font(.caption)
                                        .foregroundStyle(AppTheme.mutedForeground)

                                        GeometryReader { geo in
                                            let maxValue = max(metrics.byCategory.map(\.projectedSale).max() ?? 1, 1)
                                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                                .fill(AppTheme.primary.opacity(0.8))
                                                .frame(width: geo.size.width * CGFloat(row.projectedSale / maxValue), height: 8)
                                        }
                                        .frame(height: 8)
                                    }
                                    .padding(14)
                                    .background(AppTheme.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(AppTheme.border, lineWidth: 1)
                                    )
                                }
                            }
                        }
                    }
                    .padding(20)
                }
            } else if viewModel.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.errorMessage {
                ContentUnavailableView("Couldn't load dashboard", systemImage: "chart.bar", description: Text(error))
            }
        }
        .appScreenBackground()
        .navigationTitle("Dashboard")
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .onChange(of: viewModel.didUnauthorized) { _, unauthorized in
            if unauthorized {
                Task { await session.handleUnauthorized() }
            }
        }
    }

    private func metricCard(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(AppTheme.mutedForeground)
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(AppTheme.foreground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(AppTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppTheme.border, lineWidth: 1)
        )
    }
}

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var metrics: InventoryMetricsResponse?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var didUnauthorized = false

    private let client = APIClient.shared

    func load() async {
        isLoading = metrics == nil
        defer { isLoading = false }
        do {
            metrics = try await client.inventoryMetrics()
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
}
