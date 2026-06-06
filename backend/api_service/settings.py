import os
from urllib.parse import quote

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "passeddownandfound"
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_sslmode: str = "prefer"

    api_host: str = "0.0.0.0"
    api_port: int = int(os.environ.get("PORT") or "8091")
    api_reload: bool = True

    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    frontend_url: str = "http://localhost:5173"
    uploads_dir: str = "uploads"

    @property
    def database_url(self) -> str:
        env_url = os.environ.get("DATABASE_URL")
        if env_url:
            return env_url
        encoded_password = quote(self.db_password, safe="")
        return (
            f"postgresql://{self.db_user}:{encoded_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?sslmode={self.db_sslmode}"
        )


settings = Settings()
