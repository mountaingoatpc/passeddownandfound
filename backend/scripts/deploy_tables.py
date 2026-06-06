import logging
import sys

sys.path.insert(0, ".")

from api_service.tables import InventoryItemTable, UserLoginTable  # noqa: E402
from lib.database.database import Database  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ALL_TABLES = [UserLoginTable(), InventoryItemTable()]


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

        db.connect().commit()
    logger.info("Schema deployment complete.")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    deploy(reset=reset)
