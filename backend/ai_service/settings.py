import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = int(os.environ.get("AI_SERVICE_PORT") or "8001")
    ai_service_openai_api_key: str = ""
    ai_service_model: str = "gpt-5.5"
    ai_service_description_model: str = "gpt-5.4-mini"
    ai_service_request_timeout_seconds: int = 90


settings = Settings()
