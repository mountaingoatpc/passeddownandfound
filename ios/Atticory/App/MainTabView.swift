import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .inventory

    enum Tab: Hashable {
        case inventory
        case categories
        case dashboard
        case profile
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                InventoryListView()
            }
            .tabItem {
                Label("Inventory", systemImage: "shippingbox")
            }
            .tag(Tab.inventory)

            NavigationStack {
                CategoriesView()
            }
            .tabItem {
                Label("Categories", systemImage: "folder")
            }
            .tag(Tab.categories)

            NavigationStack {
                DashboardView()
            }
            .tabItem {
                Label("Dashboard", systemImage: "chart.bar")
            }
            .tag(Tab.dashboard)

            NavigationStack {
                ProfileView()
            }
            .tabItem {
                Label("Profile", systemImage: "person.crop.circle")
            }
            .tag(Tab.profile)
        }
        .tint(AppTheme.primary)
    }
}
