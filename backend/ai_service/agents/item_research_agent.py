import base64
import logging
from collections.abc import Iterator
from typing import Any

from openai import OpenAI

from ai_service.schemas import ItemAnalysisModelOutput
from ai_service.settings import settings

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTIONS = """You are an expert appraiser for vintage, antique, and secondhand items sold online.

Given a photo of an item, identify it and research comparable listings and sales on
eBay, Etsy, Whatnot, and other marketplaces.

Your goals:
1. Suggest a short inventory name: a brief phrase only (2-5 words, under 40 characters).
   Scannable in a table row—lead with the most recognizable identifier (maker, motif,
   material, or era). Never write a full marketplace title. Examples: "Greybeard Stoneware Jug",
   "Mitchell Bros Flask", "Art Deco Table Lamp".
2. Suggest a category (e.g. Furniture, Jewelry, Glassware, Collectibles).
3. Write a very short description in 1-2 sentences only:
   identify the item and note key details (era, maker, materials, or condition).
   Be direct and factual—no filler, no bullet lists, no section headers. Put detailed
   research in comparable_listings notes, not here.
4. Suggest condition using exactly one of these values:
   - "new" for new/unused items
   - "pre-owned:excellent", "pre-owned:good", "pre-owned:fair",
     or "pre-owned:damaged" for used items
5. Estimate projected_sale_price (USD) and starting_bid_suggestion for auctions.
6. Populate platform_price_estimates with ebay, etsy, and whatnot when you can justify
   a number. If Whatnot comps are missing, still provide an inferred whatnot estimate and
   explain the basis in comparable_listings notes.
7. Populate comparable_listings (up to 5) with real sources from your search:
   platform, title, price when known, full https url, and brief notes. Include dealer
   catalog pages and sold/active marketplace listings—not only summary prose.
8. Set confidence (0-1) based on identification certainty and comp quality.
9. Keep reasoning to 1-2 plain-text sentences summarizing the price conclusion only.
   Do not use markdown, links, or long research paragraphs in reasoning.

When the seller provides additional context, treat it as authoritative and incorporate it
into identification, condition assessment, and pricing.

Use web search to find real comparable listings and sold prices. Prefer recent data.
If exact matches are unavailable, use the closest comparables and lower confidence accordingly."""

STATUS_MESSAGES: dict[str, str] = {
    "response.created": "Starting analysis...",
    "response.in_progress": "Examining the photo...",
    "response.web_search_call.searching": "Looking for comps on marketplaces...",
    "response.web_search_call.in_progress": "Searching eBay, Etsy, and Whatnot...",
    "response.web_search_call.completed": "Reviewing comparable listings...",
    "response.output_item.added": "Building your listing details...",
    "response.output_text.delta": "Predicting price and writing description...",
    "response.reasoning_text.delta": "Thinking through the appraisal...",
    "response.reasoning_summary_text.delta": "Summarizing findings...",
}


class ItemResearchAgent:
    def __init__(self) -> None:
        if not settings.ai_service_openai_api_key:
            raise ValueError("AI_SERVICE_OPENAI_API_KEY is not configured")
        self._client = OpenAI(
            api_key=settings.ai_service_openai_api_key,
            timeout=settings.ai_service_request_timeout_seconds,
        )

    def _build_user_prompt(self, additional_context: str | None) -> str:
        prompt = (
            "Analyze this item photo for resale. Search for comparable listings "
            "on eBay, Etsy, and Whatnot. Return structured analysis."
        )
        if additional_context and additional_context.strip():
            prompt += f"\n\nAdditional context from the seller:\n{additional_context.strip()}"
        return prompt

    def _build_input(self, image_url: str, additional_context: str | None) -> list[dict[str, Any]]:
        return [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": self._build_user_prompt(additional_context)},
                    {"type": "input_image", "image_url": image_url},
                ],
            }
        ]

    def _status_for_event(self, event: Any) -> str | None:
        event_type = getattr(event, "type", None)
        if not event_type:
            return None

        if event_type in STATUS_MESSAGES:
            return STATUS_MESSAGES[event_type]

        if event_type == "response.output_item.done":
            item = getattr(event, "item", None)
            item_type = getattr(item, "type", None)
            if item_type == "web_search_call":
                return "Finished marketplace search..."
            if item_type == "message":
                return "Finalizing listing suggestions..."

        return None

    def analyze_image_stream(
        self,
        image_bytes: bytes,
        content_type: str,
        additional_context: str | None = None,
    ) -> Iterator[dict[str, Any]]:
        media_type = content_type if content_type.startswith("image/") else "image/jpeg"
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        image_url = f"data:{media_type};base64,{image_b64}"

        yield {"type": "status", "message": "Uploading photo for analysis..."}

        last_status: str | None = None

        with self._client.responses.stream(
            model=settings.ai_service_model,
            instructions=SYSTEM_INSTRUCTIONS,
            input=self._build_input(image_url, additional_context),
            tools=[{"type": "web_search"}],
            text_format=ItemAnalysisModelOutput,
        ) as stream:
            for event in stream:
                status = self._status_for_event(event)
                if status and status != last_status:
                    last_status = status
                    yield {"type": "status", "message": status}

            final_response = stream.get_final_response()
            parsed = final_response.output_parsed
            if parsed is None:
                raise ValueError("AI analysis returned empty response")

            yield {"type": "result", "data": parsed.to_response().model_dump()}
