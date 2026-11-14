import Foundation

enum MoneyFormat {
    private static let currency: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    static func string(_ value: Double) -> String {
        currency.string(from: NSNumber(value: value)) ?? String(format: "$%.2f", value)
    }
}
