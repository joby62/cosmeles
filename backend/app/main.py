# backend/app/main.py
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db.init_db import init_db
from app.routes.ingest import router as ingest_router
from app.routes.products import router as products_router
from app.settings import settings

app = FastAPI(title="Shampoo Picker API", version="0.1.0")

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
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

# static files: serve /storage/images as /images
if os.path.isdir(settings.storage_dir):
    images_dir = os.path.join(settings.storage_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    app.mount("/images", StaticFiles(directory=images_dir), name="images")