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
        Column(name="ai_evidence", column_type=ColumnType.JSONB, nullable=True),
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

    def get_all_for_owner(self, owner_uuid: str, search: str | None = None) -> list[dict[str, Any]]:
        db = Database()
        with db:
            if search and search.strip():
                query = (
                    f"SELECT * FROM {self.fully_qualified_name} "
                    f"WHERE owner_uuid = %s AND (name ILIKE %s OR description ILIKE %s) "
                    f"ORDER BY created_at DESC"
                )
                pattern = f"%{search.strip()}%"
                return (
                    db.execute(query, params=(owner_uuid, pattern, pattern), fetch=True) or []
                )
            return (
                db.execute(
                    f"SELECT * FROM {self.fully_qualified_name} WHERE owner_uuid = %s ORDER BY created_at DESC",
                    params=(owner_uuid,),
                    fetch=True,
                )
                or []
            )

    def get_by_uuid(self, uuid: str, owner_uuid: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} WHERE uuid = %s AND owner_uuid = %s",
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
        image_url: str | None = None,
        category: str = "",
        condition: str = "",
        quantity: int = 1,
        weight_pounds: int = 0,
        weight_ounces: float = 0,
        starting_bid: float = 0,
        ai_evidence: dict[str, Any] | None = None,
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
                        "image_url": image_url,
                        "ai_evidence": ai_evidence,
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
            f"WHERE uuid = %(uuid)s AND owner_uuid = %(owner_uuid)s RETURNING *"
        )
        db = Database()
        with db:
            result = db.execute(sql, params=updates, fetch=True)
        return result[0] if result else None
