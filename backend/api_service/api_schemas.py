from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    uuid: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class ComparableListingResponse(BaseModel):
    platform: str
    title: str
    price: float | None = None
    url: str | None = None
    notes: str = ""


class ItemAiEvidence(BaseModel):
    comparable_listings: list[ComparableListingResponse] = Field(default_factory=list)
    platform_estimates: dict[str, float] = Field(default_factory=dict)
    confidence: float | None = Field(default=None, ge=0, le=1)
    reasoning: str = ""


def _validate_image_urls(value: list[str]) -> list[str]:
    if len(value) > 4:
        raise ValueError("At most 4 images allowed")
    cleaned = [url.strip() for url in value if url.strip()]
    if len(cleaned) != len(value):
        raise ValueError("Image URLs cannot be empty")
    return cleaned


class CreateInventoryItemRequest(BaseModel):
    name: str = Field(min_length=1)
    category: str = ""
    description: str = ""
    condition: str = ""
    quantity: int = Field(default=1, ge=1)
    weight_pounds: int = Field(default=0, ge=0)
    weight_ounces: float = Field(default=0, ge=0)
    starting_bid: float = Field(default=0, ge=0)
    cost: float = Field(ge=0)
    projected_sale_price: float = Field(ge=0)
    actual_sale_price: float | None = Field(default=None, ge=0)
    image_urls: list[str] = Field(default_factory=list, max_length=4)
    ai_evidence: ItemAiEvidence | None = None
    run_analysis: bool = False
    analysis_context: str | None = Field(default=None, max_length=2000)

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, value: list[str]) -> list[str]:
        return _validate_image_urls(value)


class UpdateInventoryItemRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    category: str | None = None
    description: str | None = None
    condition: str | None = None
    quantity: int | None = Field(default=None, ge=1)
    weight_pounds: int | None = Field(default=None, ge=0)
    weight_ounces: float | None = Field(default=None, ge=0)
    starting_bid: float | None = Field(default=None, ge=0)
    cost: float | None = Field(default=None, ge=0)
    projected_sale_price: float | None = Field(default=None, ge=0)
    actual_sale_price: float | None = Field(default=None, ge=0)
    image_urls: list[str] | None = Field(default=None, max_length=4)
    ai_evidence: ItemAiEvidence | None = None
    run_analysis: bool | None = None
    analysis_context: str | None = Field(default=None, max_length=2000)

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _validate_image_urls(value)


class InventoryItemResponse(BaseModel):
    uuid: str
    name: str
    category: str
    description: str
    condition: str
    quantity: int
    weight_pounds: int
    weight_ounces: float
    starting_bid: float
    cost: float
    projected_sale_price: float
    actual_sale_price: float | None
    image_urls: list[str]
    ai_evidence: ItemAiEvidence | None = None
    analysis_status: str
    analysis_error: str | None = None
    owner_uuid: str
    created_at: str
    updated_at: str


class UploadResponse(BaseModel):
    image_url: str


class QueueAnalysisRequest(BaseModel):
    analysis_context: str | None = Field(default=None, max_length=2000)


class ItemAnalysisResponse(BaseModel):
    name: str
    category: str
    description: str
    condition_suggestion: str
    projected_sale_price: float
    starting_bid_suggestion: float
    platform_estimates: dict[str, float] = Field(default_factory=dict)
    comparable_listings: list[ComparableListingResponse] = Field(default_factory=list)
    confidence: float
    reasoning: str


class CreateCategoryRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)


class UpdateCategoryRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CategoryResponse(BaseModel):
    uuid: str
    name: str
    description: str
    owner_uuid: str
    created_at: str
    updated_at: str
