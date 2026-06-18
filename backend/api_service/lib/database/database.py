import logging
from typing import Any

import psycopg
from lib.database.schemas import Record, Table
from psycopg.rows import dict_row
from psycopg.types.json import Json
from psycopg_pool import ConnectionPool
from pydantic import BaseModel

logger = logging.getLogger(__name__)
_pool: ConnectionPool | None = None


def _adapt_jsonb_dict(params: dict[str, Any]) -> dict[str, Any]:
    return {key: Json(value) if isinstance(value, (dict, list)) else value for key, value in params.items()}


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        from api_service.settings import settings

        _pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=2,
            max_size=10,
            open=True,
            kwargs={"row_factory": dict_row, "connect_timeout": 10},
            check=ConnectionPool.check_connection,
            max_idle=300,
            timeout=10,
        )
    return _pool


def warmup_pool() -> None:
    pool = get_pool()
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    logger.info("Database connection pool warmed up")


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        logger.info("Database connection pool closed")


class Database(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    _connection: psycopg.Connection | None = None

    def connect(self) -> psycopg.Connection:
        if self._connection is None or self._connection.closed:
            self._connection = get_pool().getconn()
        return self._connection

    def disconnect(self) -> None:
        if self._connection is not None:
            get_pool().putconn(self._connection)
            self._connection = None

    def execute(self, sql: str, params=None, fetch: bool = False) -> list[dict[str, Any]] | None:
        conn = self.connect()
        with conn.cursor() as cursor:
            if isinstance(params, dict):
                params = _adapt_jsonb_dict(params)
            cursor.execute(sql, params)
            result = [dict(row) for row in cursor.fetchall()] if fetch else None
            conn.commit()
            return result

    def insert(self, table: Table, record: Record) -> dict[str, Any] | None:
        columns = list(record.data.keys())
        placeholders = [f"%({col})s" for col in columns]
        sql = (
            f"INSERT INTO {table.fully_qualified_name} "
            f"({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING *"
        )
        conn = self.connect()
        with conn.cursor() as cursor:
            cursor.execute(sql, _adapt_jsonb_dict(record.data))
            result = cursor.fetchone()
            conn.commit()
            return dict(result) if result else None

    def create_table(self, table: Table) -> None:
        self.execute(table.to_create_sql())
        for index_sql in table.to_create_indexes_sql():
            self.execute(index_sql)

    def drop_table(self, table: Table) -> None:
        self.execute(f"DROP TABLE IF EXISTS {table.fully_qualified_name} CASCADE")

    def __enter__(self) -> "Database":
        self.connect()
        return self

    def __exit__(self, *args: Any) -> None:
        self.disconnect()
