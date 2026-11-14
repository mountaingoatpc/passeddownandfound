import logging
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from api_service.settings import settings

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_uuid: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_uuid,
        "email": email,
        "typ": "access",
        "exp": now + timedelta(hours=settings.jwt_expiration_hours),
        "iat": now,
    }
    return _encode(payload)


def create_refresh_token(user_uuid: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_uuid,
        "email": email,
        "typ": "refresh",
        "exp": now + timedelta(days=settings.jwt_refresh_expiration_days),
        "iat": now,
    }
    return _encode(payload)


def create_token_pair(user_uuid: str, email: str) -> tuple[str, str]:
    return create_access_token(user_uuid, email), create_refresh_token(user_uuid, email)


# Backwards-compatible alias used by older call sites / tests.
def create_token(user_uuid: str, email: str) -> str:
    return create_access_token(user_uuid, email)


def decode_token(token: str, *, expected_type: str | None = "access") -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    token_type = payload.get("typ", "access")
    if expected_type is not None and token_type != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    return payload


async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(credentials.credentials, expected_type="access")
    return {"uuid": payload["sub"], "email": payload["email"]}
