import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api_service.api_schemas import (
    AuthResponse,
    CreateInventoryItemRequest,
    InventoryItemResponse,
    LoginRequest,
    RegisterRequest,
    UpdateInventoryItemRequest,
    UploadResponse,
    UserResponse,
)
from api_service.auth import create_token, get_current_user, hash_password, verify_password
from api_service.route_metadata import route_metadata
from api_service.schemas import Permission, Resource
from api_service.settings import settings
from api_service.tables import InventoryItemTable, UserLoginTable
from lib.database.database import close_pool, warmup_pool

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

UPLOADS_PATH = Path(settings.uploads_dir)
UPLOADS_PATH.mkdir(parents=True, exist_ok=True)

user_table = UserLoginTable()
inventory_table = InventoryItemTable()


def _serialize_item(row: dict) -> InventoryItemResponse:
    return InventoryItemResponse(
        uuid=str(row["uuid"]),
        name=row["name"],
        category=row.get("category") or "",
        description=row["description"] or "",
        condition=row.get("condition") or "",
        quantity=int(row.get("quantity", 1)),
        weight_pounds=int(row.get("weight_pounds", 0)),
        weight_ounces=float(row.get("weight_ounces", 0)),
        starting_bid=float(row.get("starting_bid", 0)),
        cost=float(row["cost"]),
        projected_sale_price=float(row["projected_sale_price"]),
        actual_sale_price=float(row["actual_sale_price"]) if row["actual_sale_price"] is not None else None,
        image_url=row["image_url"],
        owner_uuid=str(row["owner_uuid"]),
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    warmup_pool()
    yield
    close_pool()


app = FastAPI(title="Passed Down and Found API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_PATH)), name="uploads")


@app.get("/health")
async def health_check():
    return {"message": "healthy"}


@app.post("/auth/register", response_model=AuthResponse, openapi_extra=route_metadata(Resource.AUTH, Permission.WRITE))
async def register(request: RegisterRequest):
    existing = user_table.get_by_email(request.email.lower().strip())
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = user_table.create(request.email.lower().strip(), hash_password(request.password))
    if not user:
        raise HTTPException(status_code=500, detail="Failed to create user")

    token = create_token(str(user["uuid"]), user["email"])
    return AuthResponse(token=token, user=UserResponse(uuid=str(user["uuid"]), email=user["email"]))


@app.post("/auth/login", response_model=AuthResponse, openapi_extra=route_metadata(Resource.AUTH, Permission.READ))
async def login(request: LoginRequest):
    user = user_table.get_by_email(request.email.lower().strip())
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(str(user["uuid"]), user["email"])
    return AuthResponse(token=token, user=UserResponse(uuid=str(user["uuid"]), email=user["email"]))


@app.get("/auth/me", response_model=UserResponse, openapi_extra=route_metadata(Resource.AUTH, Permission.READ))
async def get_me(current_user: dict = Depends(get_current_user)):
    user = user_table.get_by_uuid(current_user["uuid"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(uuid=str(user["uuid"]), email=user["email"])


@app.post("/uploads", response_model=UploadResponse, openapi_extra=route_metadata(Resource.INVENTORY, Permission.WRITE))
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = Path(file.filename or "image.jpg").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}:
        ext = ".jpg"

    filename = f"{current_user['uuid']}_{uuid.uuid4().hex}{ext}"
    dest = UPLOADS_PATH / filename

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10MB")

    dest.write_bytes(content)
    return UploadResponse(image_url=f"/uploads/{filename}")


@app.get(
    "/inventory",
    response_model=list[InventoryItemResponse],
    openapi_extra=route_metadata(Resource.INVENTORY, Permission.READ),
)
async def list_inventory(
    search: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    rows = inventory_table.get_all_for_owner(current_user["uuid"], search=search)
    return [_serialize_item(row) for row in rows]


@app.post(
    "/inventory",
    response_model=InventoryItemResponse,
    openapi_extra=route_metadata(Resource.INVENTORY, Permission.WRITE),
)
async def create_inventory_item(
    request: CreateInventoryItemRequest,
    current_user: dict = Depends(get_current_user),
):
    result = inventory_table.create(
        owner_uuid=current_user["uuid"],
        name=request.name.strip(),
        category=request.category.strip(),
        description=request.description.strip(),
        condition=request.condition.strip(),
        quantity=request.quantity,
        weight_pounds=request.weight_pounds,
        weight_ounces=request.weight_ounces,
        starting_bid=request.starting_bid,
        cost=request.cost,
        projected_sale_price=request.projected_sale_price,
        actual_sale_price=request.actual_sale_price,
        image_url=request.image_url,
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create item")
    return _serialize_item(result)


@app.get(
    "/inventory/{item_uuid}",
    response_model=InventoryItemResponse,
    openapi_extra=route_metadata(Resource.INVENTORY, Permission.READ),
)
async def get_inventory_item(item_uuid: str, current_user: dict = Depends(get_current_user)):
    row = inventory_table.get_by_uuid(item_uuid, current_user["uuid"])
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize_item(row)


@app.put(
    "/inventory/{item_uuid}",
    response_model=InventoryItemResponse,
    openapi_extra=route_metadata(Resource.INVENTORY, Permission.WRITE),
)
async def update_inventory_item(
    item_uuid: str,
    request: UpdateInventoryItemRequest,
    current_user: dict = Depends(get_current_user),
):
    updates = request.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"]:
        updates["name"] = updates["name"].strip()
    if "category" in updates and updates["category"] is not None:
        updates["category"] = updates["category"].strip()
    if "description" in updates and updates["description"] is not None:
        updates["description"] = updates["description"].strip()
    if "condition" in updates and updates["condition"] is not None:
        updates["condition"] = updates["condition"].strip()

    result = inventory_table.update(item_uuid, current_user["uuid"], updates)
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize_item(result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_service.api:app", host=settings.api_host, port=settings.api_port, reload=settings.api_reload)
