from pydantic import BaseModel, Field


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
    image_url: str | None = None
    ai_evidence: ItemAiEvidence | None = None


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
    image_url: str | None = None
    ai_evidence: ItemAiEvidence | None = None


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
    image_url: str | None
    ai_evidence: ItemAiEvidence | None = None
    owner_uuid: str
    created_at: str
    updated_at: str


class UploadResponse(BaseModel):
    image_url: str


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
