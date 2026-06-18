import logging
import sys

sys.path.insert(0, ".")

from lib.database.database import Database  # noqa: E402

from api_service.tables import CategoryTable, InventoryItemTable, UserLoginTable  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ALL_TABLES = [UserLoginTable(), CategoryTable(), InventoryItemTable()]

INVENTORY_ITEM_MIGRATIONS = [
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS weight_pounds INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS weight_ounces REAL NOT NULL DEFAULT 0",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS starting_bid REAL NOT NULL DEFAULT 0",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS ai_evidence JSONB",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'",
    "UPDATE public.inventory_items SET image_urls = jsonb_build_array(image_url) "
    "WHERE image_url IS NOT NULL AND image_url != ''",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'none'",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS analysis_error TEXT",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS analysis_context TEXT",
    "ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
]


def deploy(reset: bool = False) -> None:
    db = Database()
    with db:
        db.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

        if reset:
            logger.warning("RESETTING: Dropping all tables...")
            for table in reversed(ALL_TABLES):
                db.drop_table(table)
                logger.info(f"  Dropped: {table.fully_qualified_name}")

        logger.info("Creating tables...")
        for table in ALL_TABLES:
            db.create_table(table)
            logger.info(f"  Created: {table.fully_qualified_name}")

        logger.info("Applying migrations...")
        for migration in INVENTORY_ITEM_MIGRATIONS:
            db.execute(migration)
            logger.info(f"  Applied: {migration}")

        db.connect().commit()
    logger.info("Schema deployment complete.")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    deploy(reset=reset)
