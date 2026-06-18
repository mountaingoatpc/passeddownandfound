export const CONDITION_TYPES = [
	{ value: "new", label: "New" },
	{ value: "pre-owned", label: "Pre-owned" },
] as const;

export const PRE_OWNED_GRADES = [
	{ value: "damaged", label: "Damaged" },
	{ value: "fair", label: "Fair" },
	{ value: "good", label: "Good" },
	{ value: "excellent", label: "Excellent" },
] as const;

export type ConditionType = (typeof CONDITION_TYPES)[number]["value"];
export type PreOwnedGrade = (typeof PRE_OWNED_GRADES)[number]["value"];

export interface ParsedCondition {
	type: ConditionType | "";
	grade: PreOwnedGrade | "";
}

export function parseCondition(value: string): ParsedCondition {
	if (value === "new") {
		return { type: "new", grade: "" };
	}

	if (value === "pre-owned" || value.startsWith("pre-owned:")) {
		if (value === "pre-owned") {
			return { type: "pre-owned", grade: "" };
		}

		const grade = value.slice("pre-owned:".length) as PreOwnedGrade;
		const isValidGrade = PRE_OWNED_GRADES.some(
			(option) => option.value === grade,
		);
		return { type: "pre-owned", grade: isValidGrade ? grade : "" };
	}

	return { type: "", grade: "" };
}

export function serializeCondition(
	type: ConditionType | "",
	grade: PreOwnedGrade | "",
): string {
	if (type === "new") return "new";
	if (type === "pre-owned" && grade) return `pre-owned:${grade}`;
	if (type === "pre-owned") return "pre-owned";
	return "";
}

export function formatCondition(value: string): string {
	const { type, grade } = parseCondition(value);
	if (type === "new") return "New";

	if (type === "pre-owned" && grade) {
		const label = PRE_OWNED_GRADES.find(
			(option) => option.value === grade,
		)?.label;
		return label ? `Pre-owned — ${label}` : "Pre-owned";
	}

	return "";
}

export function isConditionComplete(value: string): boolean {
	const { type, grade } = parseCondition(value);
	if (type === "new") return true;
	if (type === "pre-owned") return grade !== "";
	return false;
}
