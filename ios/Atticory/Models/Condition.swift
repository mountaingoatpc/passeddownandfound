import Foundation

enum ConditionType: String, CaseIterable, Identifiable {
    case new
    case preOwned = "pre-owned"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .new: "New"
        case .preOwned: "Pre-owned"
        }
    }
}

enum PreOwnedGrade: String, CaseIterable, Identifiable {
    case damaged
    case fair
    case good
    case excellent

    var id: String { rawValue }

    var label: String {
        switch self {
        case .damaged: "Damaged"
        case .fair: "Fair"
        case .good: "Good"
        case .excellent: "Excellent"
        }
    }
}

struct ParsedCondition: Equatable {
    var type: ConditionType?
    var grade: PreOwnedGrade?

    static func parse(_ value: String) -> ParsedCondition {
        if value == "new" {
            return ParsedCondition(type: .new, grade: nil)
        }
        if value == "pre-owned" {
            return ParsedCondition(type: .preOwned, grade: nil)
        }
        if value.hasPrefix("pre-owned:") {
            let gradeValue = String(value.dropFirst("pre-owned:".count))
            return ParsedCondition(type: .preOwned, grade: PreOwnedGrade(rawValue: gradeValue))
        }
        return ParsedCondition(type: nil, grade: nil)
    }

    func serialize() -> String {
        guard let type else { return "" }
        if type == .new { return "new" }
        if let grade {
            return "pre-owned:\(grade.rawValue)"
        }
        return "pre-owned"
    }

    var displayLabel: String {
        guard let type else { return "—" }
        if type == .new { return "New" }
        if let grade {
            return "Pre-owned — \(grade.label)"
        }
        return "Pre-owned"
    }

    var isComplete: Bool {
        guard let type else { return false }
        if type == .new { return true }
        return grade != nil
    }
}
