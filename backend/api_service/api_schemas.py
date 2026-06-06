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


class CreateInventoryItemRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    cost: float = Field(ge=0)
    projected_sale_price: float = Field(ge=0)
    actual_sale_price: float | None = Field(default=None, ge=0)
    image_url: str | None = None


class UpdateInventoryItemRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    cost: float | None = Field(default=None, ge=0)
    projected_sale_price: float | None = Field(default=None, ge=0)
    actual_sale_price: float | None = Field(default=None, ge=0)
    image_url: str | None = None


class InventoryItemResponse(BaseModel):
    uuid: str
    name: str
    description: str
    cost: float
    projected_sale_price: float
    actual_sale_price: float | None
    image_url: str | None
    owner_uuid: str
    created_at: str
    updated_at: str


class UploadResponse(BaseModel):
    image_url: str
