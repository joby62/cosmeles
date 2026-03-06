from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.settings import settings

is_sqlite = settings.database_url.startswith("sqlite")
engine_kwargs = {
    "connect_args": {"check_same_thread": False} if is_sqlite else {},
}
if not is_sqlite:
    engine_kwargs.update(
        {
            "pool_size": max(1, int(settings.db_pool_size)),
            "max_overflow": max(0, int(settings.db_max_overflow)),
            "pool_timeout": max(1, int(settings.db_pool_timeout_seconds)),
            "pool_recycle": max(30, int(settings.db_pool_recycle_seconds)),
            "pool_pre_ping": bool(settings.db_pool_pre_ping),
        }
    )

engine = create_engine(settings.database_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
