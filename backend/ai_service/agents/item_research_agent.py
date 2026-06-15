import base64
import logging
from collections.abc import Iterator
from typing import Any

from openai import OpenAI

from ai_service.schemas import (
    ItemAnalysisModelOutput,
    ItemDescriptionModelOutput,
    ItemResearchModelOutput,
)
from ai_service.settings import settings

logger = logging.getLogger(__name__)

RESEARCH_INSTRUCTIONS = """You are an expert appraiser for vintage, antique, and secondhand items sold online.

Given a photo of an item, identify it and research comparable listings and sales on
eBay, Etsy, Whatnot, and other marketplaces.

Your goals:
1. Choose exactly one category from the seller's category list provided in the prompt.
   Use the exact category name from that list.
2. Suggest condition using exactly one of these values:
   - "new" for new/unused items
   - "pre-owned:excellent", "pre-owned:good", "pre-owned:fair",
     or "pre-owned:damaged" for used items
3. Estimate projected_sale_price (USD) and starting_bid_suggestion for auctions.
4. Populate platform_price_estimates with ebay, etsy, and whatnot when you can justify
   a number. If Whatnot comps are missing, still provide an inferred whatnot estimate and
   explain the basis in comparable_listings notes.
5. Populate comparable_listings (up to 5) with real sources from your search:
   platform, title, price when known, full https url, and brief notes. Include dealer
   catalog pages and sold/active marketplace listings—not only summary prose.
6. Set confidence (0-1) based on identification certainty and comp quality.
7. Keep reasoning to 1-2 plain-text sentences summarizing the price conclusion only.
   Do not use markdown, links, or long research paragraphs in reasoning.

Do not write a listing name or description — those are generated separately.

When the seller provides additional context, treat it as authoritative and incorporate it
into identification, condition assessment, and pricing.

Use web search to find real comparable listings and sold prices. Prefer recent data.
If exact matches are unavailable, use the closest comparables and lower confidence accordingly."""

DESCRIPTION_INSTRUCTIONS = """You write short inventory labels for vintage, antique, and secondhand items.

Given a photo and research notes, produce:
1. A short inventory name: a brief phrase only (2-5 words, under 40 characters).
   Scannable in a table row—lead with the most recognizable identifier (maker, motif,
   material, or era). Never write a full marketplace title.
2. A very short description in 1-2 sentences only: identify the item and note one key
   detail (era, maker, materials, or condition). Be direct and factual—no filler, no
   bullet lists, no section headers.

Use the research notes for accuracy. Do not invent details that contradict the research."""

STATUS_MESSAGES: dict[str, str] = {
    "response.created": "Starting analysis...",
    "response.in_progress": "Examining the photo...",
    "response.web_search_call.searching": "Looking for comps on marketplaces...",
    "response.web_search_call.in_progress": "Searching eBay, Etsy, and Whatnot...",
    "response.web_search_call.completed": "Reviewing comparable listings...",
    "response.output_item.added": "Building your listing details...",
    "response.output_text.delta": "Predicting price...",
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

    def _build_user_prompt(
        self,
        additional_context: str | None,
        categories: list[dict[str, str]] | None = None,
    ) -> str:
        prompt = (
            "Analyze this item photo for resale. Search for comparable listings "
            "on eBay, Etsy, and Whatnot. Return structured research and pricing."
        )
        if categories:
            category_lines = [
                f'- "{category["name"]}"'
                + (f": {category['description']}" if category.get("description") else "")
                for category in categories
            ]
            prompt += (
                "\n\nChoose exactly one category from this seller-defined list. "
                "Return the exact category name:\n"
                + "\n".join(category_lines)
            )
        if additional_context and additional_context.strip():
            prompt += f"\n\nAdditional context from the seller:\n{additional_context.strip()}"
        return prompt

    def _build_input(
        self,
        image_url: str,
        additional_context: str | None,
        categories: list[dict[str, str]] | None = None,
    ) -> list[dict[str, Any]]:
        return [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": self._build_user_prompt(additional_context, categories),
                    },
                    {"type": "input_image", "image_url": image_url},
                ],
            }
        ]

    def _build_description_prompt(
        self,
        research: ItemResearchModelOutput,
        additional_context: str | None,
    ) -> str:
        comp_lines = [
            f"- {listing.platform}: {listing.title}"
            + (f" (${listing.price})" if listing.price is not None else "")
            for listing in research.comparable_listings[:3]
        ]
        comps_summary = "\n".join(comp_lines) if comp_lines else "No comparable listings found."

        prompt = (
            "Write a short inventory name and description for this item.\n\n"
            f"Category: {research.category}\n"
            f"Condition: {research.condition_suggestion}\n"
            f"Estimated price: ${research.projected_sale_price:.2f}\n"
            f"Research summary: {research.reasoning}\n"
            f"Comparable listings:\n{comps_summary}"
        )
        if additional_context and additional_context.strip():
            prompt += f"\n\nSeller context:\n{additional_context.strip()}"
        return prompt

    def _build_description_input(
        self,
        image_url: str,
        research: ItemResearchModelOutput,
        additional_context: str | None,
    ) -> list[dict[str, Any]]:
        return [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": self._build_description_prompt(research, additional_context),
                    },
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

    def _run_research(
        self,
        image_url: str,
        additional_context: str | None,
        categories: list[dict[str, str]] | None = None,
    ) -> Iterator[dict[str, Any]]:
        last_status: str | None = None

        with self._client.responses.stream(
            model=settings.ai_service_model,
            instructions=RESEARCH_INSTRUCTIONS,
            input=self._build_input(image_url, additional_context, categories),
            tools=[{"type": "web_search"}],
            text_format=ItemResearchModelOutput,
        ) as stream:
            for event in stream:
                status = self._status_for_event(event)
                if status and status != last_status:
                    last_status = status
                    yield {"type": "status", "message": status}

            final_response = stream.get_final_response()
            parsed = final_response.output_parsed
            if parsed is None:
                raise ValueError("AI research returned empty response")

            yield {"type": "research", "data": parsed}

    def _generate_description(
        self,
        image_url: str,
        research: ItemResearchModelOutput,
        additional_context: str | None,
    ) -> ItemDescriptionModelOutput:
        response = self._client.responses.parse(
            model=settings.ai_service_description_model,
            instructions=DESCRIPTION_INSTRUCTIONS,
            input=self._build_description_input(image_url, research, additional_context),
            text_format=ItemDescriptionModelOutput,
        )
        parsed = response.output_parsed
        if parsed is None:
            raise ValueError("AI description generation returned empty response")
        return parsed

    def analyze_image_stream(
        self,
        image_bytes: bytes,
        content_type: str,
        additional_context: str | None = None,
        categories: list[dict[str, str]] | None = None,
    ) -> Iterator[dict[str, Any]]:
        media_type = content_type if content_type.startswith("image/") else "image/jpeg"
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        image_url = f"data:{media_type};base64,{image_b64}"

        yield {"type": "status", "message": "Uploading photo for analysis..."}

        research: ItemResearchModelOutput | None = None
        for event in self._run_research(image_url, additional_context, categories):
            if event["type"] == "research":
                research = event["data"]
            else:
                yield event

        if research is None:
            raise ValueError("AI research returned empty response")

        yield {"type": "status", "message": "Writing name and description..."}

        description = self._generate_description(image_url, research, additional_context)
        result = ItemAnalysisModelOutput.from_parts(research, description)
        yield {"type": "result", "data": result.to_response().model_dump()}
