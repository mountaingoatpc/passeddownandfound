import logging
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from urllib.parse import unquote, urlparse

import boto3
import httpx
from botocore.exceptions import ClientError

from api_service.settings import settings

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}


class ImageStorage(ABC):
    @abstractmethod
    def upload(self, owner_uuid: str, content: bytes, content_type: str, ext: str) -> str:
        """Upload image bytes and return the URL stored in the database."""

    @abstractmethod
    def fetch(self, image_url: str) -> tuple[bytes, str, str]:
        """Return image bytes, content type, and filename for analysis."""


class LocalImageStorage(ImageStorage):
    def __init__(self, uploads_dir: Path) -> None:
        self._uploads_dir = uploads_dir
        self._uploads_dir.mkdir(parents=True, exist_ok=True)

    def upload(self, owner_uuid: str, content: bytes, content_type: str, ext: str) -> str:
        del owner_uuid, content_type
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = self._uploads_dir / filename
        dest.write_bytes(content)
        return f"/uploads/{filename}"

    def fetch(self, image_url: str) -> tuple[bytes, str, str]:
        filename = Path(image_url).name
        if not filename:
            raise FileNotFoundError("Invalid local image path")
        path = self._uploads_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Local image not found: {filename}")
        content_type = _guess_content_type(filename)
        return path.read_bytes(), content_type, filename


def s3_configured() -> bool:
    return bool(
        settings.s3_bucket_name
        and settings.aws_access_key_id
        and settings.aws_secret_access_key
    )


class FallbackImageStorage(ImageStorage):
    """Try S3 first; on failure write or read from local disk instead."""

    def __init__(self, primary: ImageStorage, fallback: LocalImageStorage) -> None:
        self._primary = primary
        self._fallback = fallback

    def upload(self, owner_uuid: str, content: bytes, content_type: str, ext: str) -> str:
        try:
            return self._primary.upload(owner_uuid, content, content_type, ext)
        except Exception as exc:
            logger.warning("S3 upload failed, falling back to local disk: %s", exc)
            return self._fallback.upload(owner_uuid, content, content_type, ext)

    def fetch(self, image_url: str) -> tuple[bytes, str, str]:
        if image_url.startswith("/uploads/"):
            return self._fallback.fetch(image_url)
        try:
            return self._primary.fetch(image_url)
        except (ClientError, FileNotFoundError, httpx.HTTPError) as exc:
            logger.warning("S3 fetch failed, trying local disk: %s", exc)
            return self._fallback.fetch(image_url)


class S3ImageStorage(ImageStorage):
    def __init__(self) -> None:
        if not settings.s3_bucket_name:
            raise ValueError("S3 bucket is not configured")
        session_kwargs: dict = {"region_name": settings.aws_region}
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            session_kwargs["aws_access_key_id"] = settings.aws_access_key_id
            session_kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        self._client = boto3.client("s3", **session_kwargs)
        self._bucket = settings.s3_bucket_name
        self._region = settings.aws_region
        self._prefix = settings.s3_key_prefix.strip("/")

    def _object_key(self, owner_uuid: str, ext: str) -> str:
        filename = f"{uuid.uuid4().hex}{ext}"
        parts = [part for part in (self._prefix, owner_uuid, filename) if part]
        return "/".join(parts)

    def public_url(self, key: str) -> str:
        if settings.s3_public_base_url:
            return f"{settings.s3_public_base_url.rstrip('/')}/{key}"
        return f"https://{self._bucket}.s3.{self._region}.amazonaws.com/{key}"

    def upload(self, owner_uuid: str, content: bytes, content_type: str, ext: str) -> str:
        key = self._object_key(owner_uuid, ext)
        put_kwargs: dict = {
            "Bucket": self._bucket,
            "Key": key,
            "Body": content,
            "ContentType": content_type,
        }
        if settings.s3_acl:
            put_kwargs["ACL"] = settings.s3_acl
        self._client.put_object(**put_kwargs)
        return self.public_url(key)

    def _key_from_url(self, image_url: str) -> str | None:
        parsed = urlparse(image_url)
        if not parsed.path:
            return None

        path = unquote(parsed.path.lstrip("/"))

        if settings.s3_public_base_url and image_url.startswith(settings.s3_public_base_url.rstrip("/")):
            base_path = urlparse(settings.s3_public_base_url).path.strip("/")
            if base_path and path.startswith(f"{base_path}/"):
                return path[len(base_path) + 1 :]
            return path

        host = parsed.netloc
        if host == f"{self._bucket}.s3.{self._region}.amazonaws.com":
            return path
        if host.startswith(f"{self._bucket}.s3.") and host.endswith(".amazonaws.com"):
            return path
        if host == f"s3.{self._region}.amazonaws.com" and path.startswith(f"{self._bucket}/"):
            return path[len(self._bucket) + 1 :]

        return None

    def fetch(self, image_url: str) -> tuple[bytes, str, str]:
        key = self._key_from_url(image_url)
        if key:
            try:
                response = self._client.get_object(Bucket=self._bucket, Key=key)
            except ClientError as exc:
                raise FileNotFoundError(f"S3 object not found: {key}") from exc
            body = response["Body"].read()
            content_type = response.get("ContentType") or _guess_content_type(key)
            return body, content_type, Path(key).name

        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            response = client.get(image_url)
            response.raise_for_status()
            content_type = response.headers.get("content-type") or _guess_content_type(image_url)
            return response.content, content_type, Path(urlparse(image_url).path).name or "image.jpg"


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


def normalize_upload_extension(filename: str | None) -> str:
    ext = Path(filename or "image.jpg").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return ".jpg"
    return ext


_image_storage: ImageStorage | None = None


def get_image_storage(uploads_dir: Path | None = None) -> ImageStorage:
    global _image_storage
    if _image_storage is not None:
        return _image_storage

    local_dir = uploads_dir or Path(settings.uploads_dir)
    local = LocalImageStorage(local_dir)

    if s3_configured():
        logger.info(
            "Using S3 image storage bucket=%s (local disk fallback enabled)",
            settings.s3_bucket_name,
        )
        _image_storage = FallbackImageStorage(S3ImageStorage(), local)
    else:
        if settings.s3_bucket_name:
            logger.info(
                "S3 bucket set but credentials missing; using local image storage dir=%s",
                local_dir,
            )
        else:
            logger.info("Using local image storage dir=%s", local_dir)
        _image_storage = local
    return _image_storage


def fetch_image_bytes(image_url: str, uploads_dir: Path) -> tuple[bytes, str, str]:
    storage = get_image_storage(uploads_dir)
    try:
        return storage.fetch(image_url)
    except httpx.HTTPError as exc:
        raise FileNotFoundError(f"Unable to fetch image: {image_url}") from exc
