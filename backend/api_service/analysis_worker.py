import asyncio
import logging
from pathlib import Path

import httpx

from api_service.api_schemas import ItemAiEvidence, ItemAnalysisResponse
from api_service.image_storage import fetch_image_bytes
from api_service.settings import settings
from api_service.tables import InventoryItemTable

logger = logging.getLogger(__name__)

VALID_CONDITIONS = {
    "new",
    "pre-owned:excellent",
    "pre-owned:good",
    "pre-owned:fair",
    "pre-owned:damaged",
}

inventory_table = InventoryItemTable()


def _image_urls_from_row(row: dict) -> list[str]:
    image_urls = row.get("image_urls")
    if isinstance(image_urls, list) and image_urls:
        return [str(url) for url in image_urls if url]
    legacy_url = row.get("image_url")
    if legacy_url:
        return [str(legacy_url)]
    return []


def _analysis_to_evidence(analysis: ItemAnalysisResponse) -> dict:
    return ItemAiEvidence(
        comparable_listings=analysis.comparable_listings,
        platform_estimates=analysis.platform_estimates,
        confidence=analysis.confidence,
        reasoning=analysis.reasoning,
    ).model_dump()


def process_analysis_item(row: dict, uploads_path: Path) -> None:
    item_uuid = str(row["uuid"])
    owner_uuid = str(row["owner_uuid"])
    image_urls = _image_urls_from_row(row)
    if not image_urls:
        inventory_table.update(
            item_uuid,
            owner_uuid,
            {
                "analysis_status": "failed",
                "analysis_error": "Item has no photos to analyze.",
                "analysis_context": None,
            },
        )
        return

    try:
        image_bytes, content_type, filename = fetch_image_bytes(image_urls[0], uploads_path)
    except FileNotFoundError:
        inventory_table.update(
            item_uuid,
            owner_uuid,
            {
                "analysis_status": "failed",
                "analysis_error": "Photo file not found.",
                "analysis_context": None,
            },
        )
        return

    additional_context = row.get("analysis_context")
    form_data: dict[str, str] = {}
    if additional_context and str(additional_context).strip():
        form_data["additional_context"] = str(additional_context).strip()

    analyze_url = f"{settings.ai_service_url.rstrip('/')}/analyze-item"

    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                analyze_url,
                files={
                    "file": (
                        filename,
                        image_bytes,
                        content_type,
                    )
                },
                data=form_data,
            )
    except httpx.RequestError as exc:
        logger.exception("AI service request failed for item %s", item_uuid)
        inventory_table.update(
            item_uuid,
            owner_uuid,
            {
                "analysis_status": "failed",
                "analysis_error": "AI service is unavailable.",
                "analysis_context": None,
            },
        )
        raise exc

    if response.status_code >= 400:
        detail = "AI analysis failed"
        try:
            payload = response.json()
            if isinstance(payload, dict) and payload.get("detail"):
                detail = str(payload["detail"])
        except ValueError:
            pass
        inventory_table.update(
            item_uuid,
            owner_uuid,
            {
                "analysis_status": "failed",
                "analysis_error": detail,
                "analysis_context": None,
            },
        )
        return

    analysis = ItemAnalysisResponse.model_validate(response.json())
    updates: dict = {
        "name": analysis.name.strip(),
        "category": analysis.category.strip(),
        "description": analysis.description.strip(),
        "projected_sale_price": analysis.projected_sale_price,
        "starting_bid": analysis.starting_bid_suggestion,
        "ai_evidence": _analysis_to_evidence(analysis),
        "analysis_status": "complete",
        "analysis_error": None,
        "analysis_context": None,
    }
    if analysis.condition_suggestion in VALID_CONDITIONS:
        updates["condition"] = analysis.condition_suggestion

    inventory_table.update(item_uuid, owner_uuid, updates)
    logger.info("Completed background analysis for item %s", item_uuid)


async def run_analysis_worker(uploads_path: Path, poll_interval_seconds: float = 2.0) -> None:
    logger.info("Analysis worker started")
    while True:
        try:
            row = await asyncio.to_thread(inventory_table.claim_next_queued_analysis)
            if row is None:
                await asyncio.sleep(poll_interval_seconds)
                continue
            await asyncio.to_thread(process_analysis_item, row, uploads_path)
        except asyncio.CancelledError:
            logger.info("Analysis worker stopped")
            raise
        except Exception:
            logger.exception("Analysis worker loop error")
            await asyncio.sleep(poll_interval_seconds)
