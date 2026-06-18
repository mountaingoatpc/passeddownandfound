import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
API_SERVICE_ROOT = BACKEND_ROOT / "api_service"

for path in (BACKEND_ROOT, API_SERVICE_ROOT):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


async def _noop_analysis_worker(_path: Path) -> None:
    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        pass


@pytest.fixture(scope="session")
def api_app():
    with (
        patch("lib.database.database.warmup_pool"),
        patch("lib.database.database.close_pool"),
        patch("api_service.api.run_analysis_worker", side_effect=_noop_analysis_worker),
    ):
        from api_service.api import app

        yield app
