# backend/app/main.py
from contextlib import asynccontextmanager
import os
import mimetypes

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.db.init_db import init_db
from app.db.session import (
    assert_phase_23_pg_only_truth_contract,
    assert_phase_24_mobile_state_pg_only_truth_contract,
    assert_phase_25_sqlite_closure_contract,
    engine,
)
from app.platform.runtime_profile import describe_runtime_profile
from app.platform.storage_backend import get_runtime_storage
from app.routes.ai import router as ai_router
from app.routes.ingest import router as ingest_router
from app.routes.mobile import router as mobile_router
from app.routes.products import router as products_router
from app.settings import settings
from app.services.runtime_topology import api_routes_enabled, should_initialize_runtime_schema
from app.services.runtime_worker import start_runtime_worker_daemon


def _startup_init_db() -> None:
    if should_initialize_runtime_schema():
        init_db()
    assert_phase_23_pg_only_truth_contract()
    assert_phase_24_mobile_state_pg_only_truth_contract()
    assert_phase_25_sqlite_closure_contract()
    start_runtime_worker_daemon()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _startup_init_db()
    yield


app = FastAPI(title="Shampoo Picker API", version="0.1.0", lifespan=lifespan)

# Ensure uncommon image mime types are recognized in both StaticFiles and data-url generation.
mimetypes.add_type("image/heic", ".heic")
mimetypes.add_type("image/heif", ".heif")

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# routes
if api_routes_enabled():
    app.include_router(ingest_router)
    app.include_router(products_router)
    app.include_router(ai_router)
    app.include_router(mobile_router)

@app.get("/healthz")
def healthz():
    try:
        runtime = describe_runtime_profile()
    except Exception as exc:  # pragma: no cover - surface misconfiguration without failing health route itself.
        runtime = {
            "deploy_profile": str(settings.deploy_profile or "single_node").strip() or "single_node",
            "runtime_role": str(settings.runtime_role or "api").strip() or "api",
            "error": str(exc),
        }
    return {"status": "ok", "service": "backend", "env": settings.app_env, "runtime": runtime}

@app.get("/readyz")
def readyz():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {e}") from e

    try:
        get_runtime_storage().ensure_dirs()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Storage not ready: {e}") from e

    try:
        assert_phase_23_pg_only_truth_contract()
        assert_phase_24_mobile_state_pg_only_truth_contract()
        assert_phase_25_sqlite_closure_contract()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"PostgreSQL phase contract not ready: {e}") from e

    return {"status": "ready", "runtime": describe_runtime_profile()}

if api_routes_enabled():
    # static files: always mount /images so route is stable even on first boot
    os.makedirs(settings.storage_dir, exist_ok=True)
    images_dir = os.path.join(settings.storage_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    app.mount("/images", StaticFiles(directory=images_dir), name="images")

    os.makedirs(settings.user_storage_dir, exist_ok=True)
    user_images_dir = os.path.join(settings.user_storage_dir, "images")
    os.makedirs(user_images_dir, exist_ok=True)
    app.mount("/user-images", StaticFiles(directory=user_images_dir), name="user-images")
