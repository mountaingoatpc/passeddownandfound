import json
import logging
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from ai_service.agents.item_research_agent import ItemResearchAgent
from ai_service.schemas import ItemAnalysisResponse
from ai_service.settings import settings
from ai_service.streaming import encode_sse

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_CONTEXT_CHARS = 2000

app = FastAPI(title="atticory AI Service", version="0.1.0")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


def _validate_image(file: UploadFile, content: bytes) -> None:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 10MB")
    ext = Path(file.filename or "image.jpg").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image format")


def _parse_categories(categories_json: str | None) -> list[dict[str, str]]:
    if not categories_json or not categories_json.strip():
        return []

    try:
        parsed = json.loads(categories_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid categories payload") from exc

    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="Invalid categories payload")

    categories: list[dict[str, str]] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name", "")).strip()
        if not name:
            continue
        categories.append(
            {
                "name": name,
                "description": str(entry.get("description", "")).strip(),
            }
        )

    return categories


@app.post("/analyze-item", response_model=ItemAnalysisResponse)
async def analyze_item(
    file: UploadFile = File(...),
    additional_context: str | None = Form(default=None),
    categories_json: str | None = Form(default=None),
):
    content = await file.read()
    _validate_image(file, content)
    categories = _parse_categories(categories_json)

    if additional_context and len(additional_context) > MAX_CONTEXT_CHARS:
        raise HTTPException(status_code=400, detail="Additional context must be under 2000 characters")

    try:
        agent = ItemResearchAgent()
        for event in agent.analyze_image_stream(
            content,
            file.content_type,
            additional_context,
            categories,
        ):
            if event["type"] == "result":
                return ItemAnalysisResponse.model_validate(event["data"])
        raise ValueError("AI analysis returned empty response")
    except ValueError as exc:
        logger.warning("Analysis configuration error: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("AI analysis failed")
        raise HTTPException(
            status_code=502,
            detail="AI analysis failed. Please try again later.",
        ) from exc


@app.post("/analyze-item/stream")
async def analyze_item_stream(
    file: UploadFile = File(...),
    additional_context: str | None = Form(default=None),
    categories_json: str | None = Form(default=None),
):
    content = await file.read()
    _validate_image(file, content)
    categories = _parse_categories(categories_json)

    if additional_context and len(additional_context) > MAX_CONTEXT_CHARS:
        raise HTTPException(status_code=400, detail="Additional context must be under 2000 characters")

    def event_generator():
        try:
            agent = ItemResearchAgent()
            for event in agent.analyze_image_stream(
                content,
                file.content_type,
                additional_context,
                categories,
            ):
                if event["type"] == "status":
                    yield encode_sse("status", {"message": event["message"]})
                elif event["type"] == "result":
                    yield encode_sse("result", {"data": event["data"]})
        except ValueError as exc:
            logger.warning("Analysis configuration error: %s", exc)
            yield encode_sse("error", {"message": str(exc)})
        except Exception:
            logger.exception("AI analysis failed")
            yield encode_sse("error", {"message": "AI analysis failed. Please try again later."})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "ai_service.app:app",
        host=settings.ai_service_host,
        port=settings.ai_service_port,
        reload=True,
    )
