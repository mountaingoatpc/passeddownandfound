from enum import Enum
from typing import Any

from pydantic import BaseModel


class ColumnType(str, Enum):
    TEXT = "TEXT"
    INTEGER = "INTEGER"
    REAL = "REAL"
    BOOLEAN = "BOOLEAN"
    TIMESTAMPTZ = "TIMESTAMPTZ"
    UUID = "UUID"
    JSONB = "JSONB"


class Column(BaseModel):
    name: str
    column_type: ColumnType
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    default: str | None = None

    def to_sql(self) -> str:
        parts = [self.name, self.column_type.value]
        if self.primary_key:
            parts.append("PRIMARY KEY")
        if not self.nullable and not self.primary_key:
            parts.append("NOT NULL")
        if self.unique and not self.primary_key:
            parts.append("UNIQUE")
        if self.default is not None:
            parts.append(f"DEFAULT {self.default}")
        return " ".join(parts)


class Index(BaseModel):
    name: str
    columns: list[str]
    unique: bool = False
    method: str = "btree"
    operator_class: str | None = None

    def to_create_sql(self, table_fqn: str) -> str:
        unique = "UNIQUE " if self.unique else ""
        method = f"USING {self.method} " if self.method != "btree" else ""
        if self.operator_class:
            columns = ", ".join(f"{col} {self.operator_class}" for col in self.columns)
        else:
            columns = ", ".join(self.columns)
        return f"CREATE {unique}INDEX IF NOT EXISTS {self.name} ON {table_fqn} {method}({columns})"


class Table(BaseModel):
    name: str
    schema_name: str = "public"
    columns: list[Column] = []
    indexes: list[Index] = []

    @property
    def fully_qualified_name(self) -> str:
        return f"{self.schema_name}.{self.name}"

    def to_create_sql(self) -> str:
        column_defs = ",\n    ".join(col.to_sql() for col in self.columns)
        return f"CREATE TABLE IF NOT EXISTS {self.fully_qualified_name} (\n    {column_defs}\n)"

    def to_create_indexes_sql(self) -> list[str]:
        return [idx.to_create_sql(self.fully_qualified_name) for idx in self.indexes]


class Record(BaseModel):
    data: dict[str, Any]
