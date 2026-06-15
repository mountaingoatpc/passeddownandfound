import uuid
from pathlib import Path

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}


def normalize_upload_extension(filename: str | None) -> str:
    ext = Path(filename or "image.jpg").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return ".jpg"
    return ext


def _guess_content_type(name: str) -> str:
    ext = Path(name).suffix.lower()
    mapping = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".heic": "image/heic",
        ".heif": "image/heif",
    }
    return mapping.get(ext, "image/jpeg")


def save_upload(uploads_dir: Path, content: bytes, ext: str) -> str:
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = uploads_dir / filename
    dest.write_bytes(content)
    return f"/uploads/{filename}"


def fetch_image_bytes(image_url: str, uploads_dir: Path) -> tuple[bytes, str, str]:
    filename = Path(image_url).name
    if not filename:
        raise FileNotFoundError("Invalid local image path")
    path = uploads_dir / filename
    if not path.exists():
        raise FileNotFoundError(f"Local image not found: {filename}")
    content_type = _guess_content_type(filename)
    return path.read_bytes(), content_type, filename
