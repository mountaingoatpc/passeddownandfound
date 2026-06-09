FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY ai_service/ ./ai_service/

ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import os; import urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health')"

CMD ["sh", "-c", "uvicorn ai_service.app:app --host 0.0.0.0 --port ${PORT:-8001}"]
