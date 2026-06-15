import json
from typing import Any


def categories_for_ai(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "name": str(row["name"]),
            "description": str(row.get("description") or ""),
        }
        for row in rows
    ]


def categories_to_json(categories: list[dict[str, str]]) -> str:
    return json.dumps(categories)


def resolve_ai_category(ai_category: str, categories: list[dict[str, str]]) -> str:
    normalized = ai_category.strip().lower()
    if not normalized:
        return ""

    for category in categories:
        if category["name"].strip().lower() == normalized:
            return category["name"]

    return ""
