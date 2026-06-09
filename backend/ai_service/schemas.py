from pydantic import BaseModel, Field


class ComparableListing(BaseModel):
    platform: str
    title: str
    price: float | None = None
    url: str | None = None
    notes: str = ""


class PlatformEstimate(BaseModel):
    platform: str
    price: float


class ItemAnalysisModelOutput(BaseModel):
    """Structured output schema for OpenAI responses.parse(text_format=...)."""

    name: str = Field(
        max_length=60,
        description=(
            "Short unique inventory label, 3-6 words and under 50 characters. "
            "Scannable in a list—not a full marketplace title."
        ),
    )
    category: str = Field(description="Item category such as Collectibles or Glassware.")
    description: str = Field(
        description="Full marketplace listing description with identification, era, marks, and condition."
    )
    condition_suggestion: str = Field(
        description="One of: new, pre-owned:excellent, pre-owned:good, pre-owned:fair, pre-owned:damaged."
    )
    projected_sale_price: float = Field(description="Estimated resale price in USD.")
    starting_bid_suggestion: float = Field(description="Suggested auction starting bid in USD.")
    platform_price_estimates: list[PlatformEstimate] = Field(
        default_factory=list,
        description="Per-platform price estimates for ebay, etsy, whatnot when justified.",
    )
    comparable_listings: list[ComparableListing] = Field(
        default_factory=list,
        description="Up to 5 comparable listings or dealer references with URLs from web search.",
    )
    confidence: float = Field(description="Confidence score from 0 to 1.")
    reasoning: str = Field(
        description="Brief 1-2 sentence plain-text price summary. No markdown or URLs."
    )

    def to_response(self) -> "ItemAnalysisResponse":
        return ItemAnalysisResponse(
            name=self.name,
            category=self.category,
            description=self.description,
            condition_suggestion=self.condition_suggestion,
            projected_sale_price=self.projected_sale_price,
            starting_bid_suggestion=self.starting_bid_suggestion,
            platform_estimates={estimate.platform: estimate.price for estimate in self.platform_price_estimates},
            comparable_listings=self.comparable_listings,
            confidence=self.confidence,
            reasoning=self.reasoning,
        )


class ItemAnalysisResponse(BaseModel):
    name: str
    category: str
    description: str
    condition_suggestion: str
    projected_sale_price: float = Field(ge=0)
    starting_bid_suggestion: float = Field(ge=0)
    platform_estimates: dict[str, float] = Field(default_factory=dict)
    comparable_listings: list[ComparableListing] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    reasoning: str
