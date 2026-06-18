from typing import Any

from lib.database.database import Database
from lib.database.schemas import Column, ColumnType, Index, Record, Table


class UserLoginTable(Table):
    name: str = "user_login"
    columns: list[Column] = [
        Column(name="uuid", column_type=ColumnType.UUID, primary_key=True, default="gen_random_uuid()"),
        Column(name="email", column_type=ColumnType.TEXT, nullable=False, unique=True),
        Column(name="password_hash", column_type=ColumnType.TEXT, nullable=False),
        Column(name="created_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
        Column(name="updated_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
    ]
    indexes: list[Index] = [
        Index(name="idx_user_login_email", columns=["email"], unique=True),
    ]

    def get_by_email(self, email: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} WHERE email = %s",
                params=(email,),
                fetch=True,
            )
        return result[0] if result else None

    def get_by_uuid(self, uuid: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} WHERE uuid = %s",
                params=(uuid,),
                fetch=True,
            )
        return result[0] if result else None

    def create(self, email: str, password_hash: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            return db.insert(self, Record(data={"email": email, "password_hash": password_hash}))


class CategoryTable(Table):
    name: str = "categories"
    columns: list[Column] = [
        Column(name="uuid", column_type=ColumnType.UUID, primary_key=True, default="gen_random_uuid()"),
        Column(name="owner_uuid", column_type=ColumnType.UUID, nullable=False),
        Column(name="name", column_type=ColumnType.TEXT, nullable=False),
        Column(name="description", column_type=ColumnType.TEXT, nullable=False, default="''"),
        Column(name="deleted_at", column_type=ColumnType.TIMESTAMPTZ, nullable=True),
        Column(name="created_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
        Column(name="updated_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
    ]
    indexes: list[Index] = [
        Index(name="idx_categories_owner", columns=["owner_uuid"]),
    ]

    _ACTIVE_FILTER = "deleted_at IS NULL"

    def get_all_for_owner(self, owner_uuid: str) -> list[dict[str, Any]]:
        db = Database()
        with db:
            return (
                db.execute(
                    f"SELECT * FROM {self.fully_qualified_name} "
                    f"WHERE owner_uuid = %s AND {self._ACTIVE_FILTER} "
                    f"ORDER BY name ASC",
                    params=(owner_uuid,),
                    fetch=True,
                )
                or []
            )

    def get_by_uuid(self, uuid: str, owner_uuid: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} "
                f"WHERE uuid = %s AND owner_uuid = %s AND {self._ACTIVE_FILTER}",
                params=(uuid, owner_uuid),
                fetch=True,
            )
        return result[0] if result else None

    def get_by_name(self, owner_uuid: str, name: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} "
                f"WHERE owner_uuid = %s AND lower(name) = lower(%s) AND {self._ACTIVE_FILTER}",
                params=(owner_uuid, name.strip()),
                fetch=True,
            )
        return result[0] if result else None

    def create(self, owner_uuid: str, name: str, description: str = "") -> dict[str, Any] | None:
        db = Database()
        with db:
            return db.insert(
                self,
                Record(
                    data={
                        "owner_uuid": owner_uuid,
                        "name": name.strip(),
                        "description": description.strip(),
                    }
                ),
            )

    def update(self, uuid: str, owner_uuid: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        if not updates:
            return self.get_by_uuid(uuid, owner_uuid)

        set_clause = ", ".join(f"{key} = %({key})s" for key in updates)
        updates["uuid"] = uuid
        updates["owner_uuid"] = owner_uuid
        sql = (
            f"UPDATE {self.fully_qualified_name} SET {set_clause}, updated_at = now() "
            f"WHERE uuid = %(uuid)s AND owner_uuid = %(owner_uuid)s "
            f"AND {self._ACTIVE_FILTER} RETURNING *"
        )
        db = Database()
        with db:
            result = db.execute(sql, params=updates, fetch=True)
        return result[0] if result else None

    def soft_delete(self, uuid: str, owner_uuid: str) -> dict[str, Any] | None:
        sql = (
            f"UPDATE {self.fully_qualified_name} "
            "SET deleted_at = now(), updated_at = now() "
            f"WHERE uuid = %(uuid)s AND owner_uuid = %(owner_uuid)s "
            f"AND {self._ACTIVE_FILTER} RETURNING *"
        )
        db = Database()
        with db:
            result = db.execute(
                sql,
                params={"uuid": uuid, "owner_uuid": owner_uuid},
                fetch=True,
            )
        return result[0] if result else None


class InventoryItemTable(Table):
    name: str = "inventory_items"
    columns: list[Column] = [
        Column(name="uuid", column_type=ColumnType.UUID, primary_key=True, default="gen_random_uuid()"),
        Column(name="owner_uuid", column_type=ColumnType.UUID, nullable=False),
        Column(name="name", column_type=ColumnType.TEXT, nullable=False),
        Column(name="category", column_type=ColumnType.TEXT, nullable=False, default="''"),
        Column(name="description", column_type=ColumnType.TEXT, nullable=False, default="''"),
        Column(name="condition", column_type=ColumnType.TEXT, nullable=False, default="''"),
        Column(name="quantity", column_type=ColumnType.INTEGER, nullable=False, default="1"),
        Column(name="weight_pounds", column_type=ColumnType.INTEGER, nullable=False, default="0"),
        Column(name="weight_ounces", column_type=ColumnType.REAL, nullable=False, default="0"),
        Column(name="starting_bid", column_type=ColumnType.REAL, nullable=False, default="0"),
        Column(name="cost", column_type=ColumnType.REAL, nullable=False, default="0"),
        Column(name="projected_sale_price", column_type=ColumnType.REAL, nullable=False, default="0"),
        Column(name="actual_sale_price", column_type=ColumnType.REAL, nullable=True),
        Column(name="image_url", column_type=ColumnType.TEXT, nullable=True),
        Column(name="image_urls", column_type=ColumnType.JSONB, nullable=False, default="'[]'"),
        Column(name="ai_evidence", column_type=ColumnType.JSONB, nullable=True),
        Column(name="analysis_status", column_type=ColumnType.TEXT, nullable=False, default="'none'"),
        Column(name="analysis_error", column_type=ColumnType.TEXT, nullable=True),
        Column(name="analysis_context", column_type=ColumnType.TEXT, nullable=True),
        Column(name="deleted_at", column_type=ColumnType.TIMESTAMPTZ, nullable=True),
        Column(name="created_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
        Column(name="updated_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
    ]
    indexes: list[Index] = [
        Index(name="idx_inventory_items_owner", columns=["owner_uuid"]),
        Index(
            name="idx_inventory_items_search",
            columns=["name"],
            method="gin",
            operator_class="gin_trgm_ops",
        ),
    ]

    _ACTIVE_FILTER = "deleted_at IS NULL"
    _LIST_COLUMNS = (
        "uuid, name, description, cost, projected_sale_price, actual_sale_price, "
        "image_url, image_urls, analysis_status, analysis_error"
    )
    _UNCATEGORIZED_LABEL = "Uncategorized"

    def _search_clause(self, search: str | None) -> tuple[str, tuple[Any, ...]]:
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            return " AND (name ILIKE %s OR description ILIKE %s)", (pattern, pattern)
        return "", ()

    def count_for_owner(self, owner_uuid: str, search: str | None = None) -> int:
        search_clause, search_params = self._search_clause(search)
        db = Database()
        with db:
            result = db.execute(
                f"SELECT COUNT(*) AS count FROM {self.fully_qualified_name} "
                f"WHERE owner_uuid = %s AND {self._ACTIVE_FILTER}{search_clause}",
                params=(owner_uuid, *search_params),
                fetch=True,
            )
        return int(result[0]["count"]) if result else 0

    def list_for_owner(
        self,
        owner_uuid: str,
        search: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        search_clause, search_params = self._search_clause(search)
        db = Database()
        with db:
            return (
                db.execute(
                    f"SELECT {self._LIST_COLUMNS} FROM {self.fully_qualified_name} "
                    f"WHERE owner_uuid = %s AND {self._ACTIVE_FILTER}{search_clause} "
                    f"ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    params=(owner_uuid, *search_params, limit, offset),
                    fetch=True,
                )
                or []
            )

    def get_metrics_for_owner(self, owner_uuid: str) -> dict[str, Any]:
        db = Database()
        with db:
            totals = db.execute(
                f"SELECT "
                f"COALESCE(SUM(cost * quantity), 0) AS total_cost, "
                f"COALESCE(SUM(projected_sale_price * quantity), 0) AS total_projected_sale, "
                f"COUNT(*) FILTER (WHERE actual_sale_price IS NOT NULL) AS items_sold "
                f"FROM {self.fully_qualified_name} "
                f"WHERE owner_uuid = %s AND {self._ACTIVE_FILTER}",
                params=(owner_uuid,),
                fetch=True,
            )
            by_category = (
                db.execute(
                    f"SELECT "
                    f"COALESCE(NULLIF(TRIM(category), ''), %s) AS category, "
                    f"COALESCE(SUM(cost * quantity), 0) AS cost, "
                    f"COALESCE(SUM(projected_sale_price * quantity), 0) AS projected_sale "
                    f"FROM {self.fully_qualified_name} "
                    f"WHERE owner_uuid = %s AND {self._ACTIVE_FILTER} "
                    f"GROUP BY 1 ORDER BY 1",
                    params=(self._UNCATEGORIZED_LABEL, owner_uuid),
                    fetch=True,
                )
                or []
            )

        row = totals[0] if totals else {}
        total_cost = float(row.get("total_cost", 0))
        total_projected_sale = float(row.get("total_projected_sale", 0))
        return {
            "total_cost": total_cost,
            "total_projected_sale": total_projected_sale,
            "projected_profit": total_projected_sale - total_cost,
            "items_sold": int(row.get("items_sold", 0)),
            "by_category": by_category,
        }

    def get_all_for_owner(self, owner_uuid: str, search: str | None = None) -> list[dict[str, Any]]:
        db = Database()
        with db:
            if search and search.strip():
                query = (
                    f"SELECT * FROM {self.fully_qualified_name} "
                    f"WHERE owner_uuid = %s AND {self._ACTIVE_FILTER} "
                    f"AND (name ILIKE %s OR description ILIKE %s) "
                    f"ORDER BY created_at DESC"
                )
                pattern = f"%{search.strip()}%"
                return db.execute(query, params=(owner_uuid, pattern, pattern), fetch=True) or []
            return (
                db.execute(
                    f"SELECT * FROM {self.fully_qualified_name} "
                    f"WHERE owner_uuid = %s AND {self._ACTIVE_FILTER} "
                    f"ORDER BY created_at DESC",
                    params=(owner_uuid,),
                    fetch=True,
                )
                or []
            )

    def get_by_uuid(self, uuid: str, owner_uuid: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} "
                f"WHERE uuid = %s AND owner_uuid = %s AND {self._ACTIVE_FILTER}",
                params=(uuid, owner_uuid),
                fetch=True,
            )
        return result[0] if result else None

    def create(
        self,
        owner_uuid: str,
        name: str,
        description: str,
        cost: float,
        projected_sale_price: float,
        actual_sale_price: float | None = None,
        image_urls: list[str] | None = None,
        category: str = "",
        condition: str = "",
        quantity: int = 1,
        weight_pounds: int = 0,
        weight_ounces: float = 0,
        starting_bid: float = 0,
        ai_evidence: dict[str, Any] | None = None,
        analysis_status: str = "none",
        analysis_error: str | None = None,
        analysis_context: str | None = None,
    ) -> dict[str, Any] | None:
        db = Database()
        with db:
            return db.insert(
                self,
                Record(
                    data={
                        "owner_uuid": owner_uuid,
                        "name": name,
                        "category": category,
                        "description": description,
                        "condition": condition,
                        "quantity": quantity,
                        "weight_pounds": weight_pounds,
                        "weight_ounces": weight_ounces,
                        "starting_bid": starting_bid,
                        "cost": cost,
                        "projected_sale_price": projected_sale_price,
                        "actual_sale_price": actual_sale_price,
                        "image_urls": image_urls or [],
                        "ai_evidence": ai_evidence,
                        "analysis_status": analysis_status,
                        "analysis_error": analysis_error,
                        "analysis_context": analysis_context,
                    }
                ),
            )

    def update(self, uuid: str, owner_uuid: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        if not updates:
            return self.get_by_uuid(uuid, owner_uuid)

        set_clause = ", ".join(f"{key} = %({key})s" for key in updates)
        updates["uuid"] = uuid
        updates["owner_uuid"] = owner_uuid
        sql = (
            f"UPDATE {self.fully_qualified_name} SET {set_clause}, updated_at = now() "
            f"WHERE uuid = %(uuid)s AND owner_uuid = %(owner_uuid)s "
            f"AND {self._ACTIVE_FILTER} RETURNING *"
        )
        db = Database()
        with db:
            result = db.execute(sql, params=updates, fetch=True)
        return result[0] if result else None

    def soft_delete(self, uuid: str, owner_uuid: str) -> dict[str, Any] | None:
        sql = (
            f"UPDATE {self.fully_qualified_name} "
            "SET deleted_at = now(), updated_at = now() "
            f"WHERE uuid = %(uuid)s AND owner_uuid = %(owner_uuid)s "
            f"AND {self._ACTIVE_FILTER} RETURNING *"
        )
        db = Database()
        with db:
            result = db.execute(
                sql,
                params={"uuid": uuid, "owner_uuid": owner_uuid},
                fetch=True,
            )
        return result[0] if result else None

    def claim_next_queued_analysis(self) -> dict[str, Any] | None:
        sql = (
            f"UPDATE {self.fully_qualified_name} "
            "SET analysis_status = 'running', updated_at = now() "
            "WHERE uuid = ("
            f"  SELECT uuid FROM {self.fully_qualified_name} "
            f"  WHERE analysis_status = 'queued' AND {self._ACTIVE_FILTER} "
            "  ORDER BY created_at ASC "
            "  FOR UPDATE SKIP LOCKED "
            "  LIMIT 1"
            ") "
            "RETURNING *"
        )
        db = Database()
        with db:
            result = db.execute(sql, fetch=True)
        return result[0] if result else None
