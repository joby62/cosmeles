# backend/app/db/init_db.py
import os

from app.db.models import Base
from app.db.session import engine
from app.settings import settings


def init_db() -> None:
    """
    Ensure storage dirs exist and create SQLite tables (idempotent).
    """
    os.makedirs(settings.storage_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.storage_dir, "products"), exist_ok=True)

    # Create tables if not exist
    Base.metadata.create_all(bind=engine)


def main() -> None:
    init_db()
    print("DB initialized.")


if __name__ == "__main__":
    main()