# backend/app/main.py
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.db.init_db import init_db
from app.db.session import engine
from app.routes.ingest import router as ingest_router
from app.routes.products import router as products_router
from app.settings import settings

app = FastAPI(title="Shampoo Picker API", version="0.1.0")

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Init DB (create tables) on startup
@app.on_event("startup")
def _startup_init_db() -> None:
    init_db()


# routes
app.include_router(ingest_router)
app.include_router(products_router)

@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "backend", "env": settings.app_env}

@app.get("/readyz")
def readyz():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {e}") from e

    try:
        os.makedirs(settings.storage_dir, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Storage not ready: {e}") from e

    return {"status": "ready"}

# static files: always mount /images so route is stable even on first boot
os.makedirs(settings.storage_dir, exist_ok=True)
images_dir = os.path.join(settings.storage_dir, "images")
os.makedirs(images_dir, exist_ok=True)
app.mount("/images", StaticFiles(directory=images_dir), name="images")
