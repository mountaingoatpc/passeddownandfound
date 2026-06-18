import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from lib.database.database import close_pool, warmup_pool

from api_service.analysis_worker import run_analysis_worker
from api_service.api_schemas import (
    AuthResponse,
    CategoryResponse,
    CreateCategoryRequest,
    CreateInventoryItemRequest,
    InventoryItemResponse,
    ItemAiEvidence,
    ItemAnalysisResponse,
    LoginRequest,
    QueueAnalysisRequest,
    RegisterRequest,
    UpdateCategoryRequest,
    UpdateInventoryItemRequest,
    UploadResponse,
    UserResponse,
)
from api_service.auth import create_token, get_current_user, hash_password, verify_password
from api_service.category_utils import categories_for_ai, categories_to_json, resolve_ai_category
from api_service.image_storage import normalize_upload_extension, save_upload
from api_service.route_metadata import route_metadata
from api_service.schemas import Permission, Resource
from api_service.settings import settings
from api_service.tables import CategoryTable, InventoryItemTable, UserLoginTable

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

UPLOADS_PATH = Path(settings.uploads_dir)
UPLOADS_PATH.mkdir(parents=True, exist_ok=True)

user_table = UserLoginTable()
category_table = CategoryTable()
inventory_table = InventoryItemTable()


def _serialize_ai_evidence(raw: dict | None) -> ItemAiEvidence | None:
    if not raw:
        return None
    return ItemAiEvidence.model_validate(raw)


def _serialize_image_urls(row: dict) -> list[str]:
    image_urls = row.get("image_urls")
    if isinstance(image_urls, list) and image_urls:
        return [str(url) for url in image_urls if url]
    legacy_url = row.get("image_url")
    if legacy_url:
        return [str(legacy_url)]
    return []


def _serialize_category(row: dict) -> CategoryResponse:
    return CategoryResponse(
        uuid=str(row["uuid"]),
        name=row["name"],
        description=row.get("description") or "",
        owner_uuid=str(row["owner_uuid"]),
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
    )


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
        image_urls=_serialize_image_urls(row),
        ai_evidence=_serialize_ai_evidence(row.get("ai_evidence")),
        analysis_status=row.get("analysis_status") or "none",
        analysis_error=row.get("analysis_error"),
        owner_uuid=str(row["owner_uuid"]),
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
    )


def _queue_item_analysis(
    item_uuid: str,
    owner_uuid: str,
    analysis_context: str | None = None,
) -> dict:
    row = inventory_table.get_by_uuid(item_uuid, owner_uuid)
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    if not _serialize_image_urls(row):
        raise HTTPException(status_code=400, detail="Item has no photos to analyze")
    if row.get("analysis_status") in {"queued", "running"}:
        raise HTTPException(status_code=409, detail="Analysis already in progress")

    context = analysis_context.strip() if analysis_context and analysis_context.strip() else None
    result = inventory_table.update(
        item_uuid,
        owner_uuid,
        {
            "analysis_status": "queued",
            "analysis_error": None,
            "analysis_context": context,
        },
    )
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return result


def _owner_categories_for_ai(owner_uuid: str) -> list[dict[str, str]]:
    rows = category_table.get_all_for_owner(owner_uuid)
    return categories_for_ai(rows)


def _analysis_form_data(
    additional_context: str | None,
    categories: list[dict[str, str]],
) -> dict[str, str]:
    form_data: dict[str, str] = {}
    if additional_context and additional_context.strip():
        form_data["additional_context"] = additional_context.strip()
    if categories:
        form_data["categories_json"] = categories_to_json(categories)
    return form_data


def _apply_resolved_category(
    analysis: ItemAnalysisResponse,
    categories: list[dict[str, str]],
) -> ItemAnalysisResponse:
    resolved = resolve_ai_category(analysis.category, categories)
    if resolved == analysis.category:
        return analysis
    return analysis.model_copy(update={"category": resolved})


@asynccontextmanager
async def lifespan(app: FastAPI):
    warmup_pool()
    worker_task = asyncio.create_task(run_analysis_worker(UPLOADS_PATH))
    try:
        yield
    finally:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
        close_pool()


app = FastAPI(title="atticory API", version="0.1.0", lifespan=lifespan)

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

    ext = normalize_upload_extension(file.filename)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10MB")

    try:
        image_url = save_upload(UPLOADS_PATH, content, ext)
    except OSError as exc:
        logger.exception("Image upload failed")
        raise HTTPException(status_code=500, detail="Failed to upload image") from exc

    return UploadResponse(image_url=image_url)


@app.post(
    "/inventory/analyze",
    response_model=ItemAnalysisResponse,
    openapi_extra=route_metadata(Resource.INVENTORY, Permission.READ),
)
async def analyze_inventory_item(
    file: UploadFile = File(...),
    additional_context: str | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
):
    del current_user

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10MB")

    analyze_url = f"{settings.ai_service_url.rstrip('/')}/analyze-item"
    categories = _owner_categories_for_ai(current_user["uuid"])
    form_data = _analysis_form_data(additional_context, categories)

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                analyze_url,
                files={
                    "file": (
                        file.filename or "image.jpg",
                        content,
                        file.content_type,
                    )
                },
                data=form_data,
            )
    except httpx.RequestError as exc:
        logger.exception("AI service request failed")
        raise HTTPException(status_code=502, detail="AI service is unavailable") from exc

    if response.status_code >= 400:
        detail = "AI analysis failed"
        try:
            payload = response.json()
            if isinstance(payload, dict) and payload.get("detail"):
                detail = str(payload["detail"])
        except ValueError:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)

    analysis = ItemAnalysisResponse.model_validate(response.json())
    return _apply_resolved_category(analysis, categories)


@app.post(
    "/inventory/analyze/stream",
    openapi_extra=route_metadata(Resource.INVENTORY, Permission.READ),
)
async def analyze_inventory_item_stream(
    file: UploadFile = File(...),
    additional_context: str | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
):
    del current_user

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10MB")

    analyze_url = f"{settings.ai_service_url.rstrip('/')}/analyze-item/stream"
    categories = _owner_categories_for_ai(current_user["uuid"])
    form_data = _analysis_form_data(additional_context, categories)

    async def proxy_stream():
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST",
                    analyze_url,
                    files={
                        "file": (
                            file.filename or "image.jpg",
                            content,
                            file.content_type,
                        )
                    },
                    data=form_data,
                ) as response:
                    if response.status_code >= 400:
                        detail = "AI analysis failed"
                        try:
                            payload = await response.aread()
                            body = json.loads(payload)
                            if isinstance(body, dict) and body.get("detail"):
                                detail = str(body["detail"])
                        except (ValueError, TypeError):
                            pass
                        yield f"event: error\ndata: {json.dumps({'message': detail})}\n\n"
                        return

                    async for chunk in response.aiter_bytes():
                        yield chunk
        except httpx.RequestError:
            logger.exception("AI service stream request failed")
            yield 'event: error\ndata: {"message": "AI service is unavailable"}\n\n'

    return StreamingResponse(
        proxy_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
    if request.run_analysis and not request.image_urls:
        raise HTTPException(status_code=400, detail="Add at least one photo to analyze with AI")

    if request.run_analysis and not _owner_categories_for_ai(current_user["uuid"]):
        raise HTTPException(
            status_code=400,
            detail="Create at least one category before running AI analysis",
        )

    analysis_status = "queued" if request.run_analysis else "none"
    analysis_context = (
        request.analysis_context.strip()
        if request.run_analysis and request.analysis_context and request.analysis_context.strip()
        else None
    )

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
        image_urls=request.image_urls,
        ai_evidence=request.ai_evidence.model_dump() if request.ai_evidence else None,
        analysis_status=analysis_status,
        analysis_context=analysis_context,
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
    if "ai_evidence" in updates and updates["ai_evidence"] is not None:
        updates["ai_evidence"] = ItemAiEvidence.model_validate(updates["ai_evidence"]).model_dump()

    run_analysis = updates.pop("run_analysis", None)
    analysis_context = updates.pop("analysis_context", None)

    result = inventory_table.update(item_uuid, current_user["uuid"], updates)
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")

    if run_analysis:
        if not _owner_categories_for_ai(current_user["uuid"]):
            raise HTTPException(
                status_code=400,
                detail="Create at least one category before running AI analysis",
            )
        result = _queue_item_analysis(item_uuid, current_user["uuid"], analysis_context)

    return _serialize_item(result)


@app.post(
    "/inventory/{item_uuid}/analyze",
    response_model=InventoryItemResponse,
    status_code=202,
    openapi_extra=route_metadata(Resource.INVENTORY, Permission.WRITE),
)
async def queue_inventory_analysis(
    item_uuid: str,
    request: QueueAnalysisRequest | None = None,
    current_user: dict = Depends(get_current_user),
):
    if not _owner_categories_for_ai(current_user["uuid"]):
        raise HTTPException(
            status_code=400,
            detail="Create at least one category before running AI analysis",
        )
    context = request.analysis_context if request else None
    result = _queue_item_analysis(item_uuid, current_user["uuid"], context)
    return _serialize_item(result)


@app.delete(
    "/inventory/{item_uuid}",
    status_code=204,
    openapi_extra=route_metadata(Resource.INVENTORY, Permission.WRITE),
)
async def remove_inventory_item(item_uuid: str, current_user: dict = Depends(get_current_user)):
    result = inventory_table.soft_delete(item_uuid, current_user["uuid"])
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")


@app.get(
    "/categories",
    response_model=list[CategoryResponse],
    openapi_extra=route_metadata(Resource.CATEGORY, Permission.READ),
)
async def list_categories(current_user: dict = Depends(get_current_user)):
    rows = category_table.get_all_for_owner(current_user["uuid"])
    return [_serialize_category(row) for row in rows]


@app.post(
    "/categories",
    response_model=CategoryResponse,
    openapi_extra=route_metadata(Resource.CATEGORY, Permission.WRITE),
)
async def create_category(
    request: CreateCategoryRequest,
    current_user: dict = Depends(get_current_user),
):
    name = request.name.strip()
    if category_table.get_by_name(current_user["uuid"], name):
        raise HTTPException(status_code=400, detail="Category name already exists")

    result = category_table.create(
        owner_uuid=current_user["uuid"],
        name=name,
        description=request.description.strip(),
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create category")
    return _serialize_category(result)


@app.put(
    "/categories/{category_uuid}",
    response_model=CategoryResponse,
    openapi_extra=route_metadata(Resource.CATEGORY, Permission.WRITE),
)
async def update_category(
    category_uuid: str,
    request: UpdateCategoryRequest,
    current_user: dict = Depends(get_current_user),
):
    updates = request.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] is not None:
        name = updates["name"].strip()
        existing = category_table.get_by_name(current_user["uuid"], name)
        if existing and str(existing["uuid"]) != category_uuid:
            raise HTTPException(status_code=400, detail="Category name already exists")
        updates["name"] = name
    if "description" in updates and updates["description"] is not None:
        updates["description"] = updates["description"].strip()

    result = category_table.update(category_uuid, current_user["uuid"], updates)
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    return _serialize_category(result)


@app.delete(
    "/categories/{category_uuid}",
    status_code=204,
    openapi_extra=route_metadata(Resource.CATEGORY, Permission.WRITE),
)
async def remove_category(category_uuid: str, current_user: dict = Depends(get_current_user)):
    result = category_table.soft_delete(category_uuid, current_user["uuid"])
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_service.api:app", host=settings.api_host, port=settings.api_port, reload=settings.api_reload)
