from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# === 路径基准（backend 目录）===
BACKEND_DIR = Path(__file__).resolve().parents[1]  # backend/
DEFAULT_STORAGE_DIR = BACKEND_DIR / "storage"

class Settings(BaseSettings):
    # === 基础环境 ===
    app_env: str = "dev"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5000,http://127.0.0.1:5000,http://localhost:5001,http://127.0.0.1:5001"

    # === 存储路径（绝对路径，关键）===
    storage_dir: str = str(DEFAULT_STORAGE_DIR)

    # === 数据库 ===
    # SQLite 文件将位于 backend/storage/app.db
    database_url: str = f"sqlite:///{(DEFAULT_STORAGE_DIR / 'app.db').as_posix()}"

    # === 豆包配置 ===
    doubao_mode: str = "real"  # sample/mock | real
    ark_api_key: str = ""
    doubao_api_key: str = ""
    doubao_endpoint: str = "https://ark.cn-beijing.volces.com/api/v3"
    doubao_model: str = "doubao-seed-2-0-mini-260215"  # legacy fallback
    doubao_vision_model: str = "doubao-seed-2-0-mini-260215"
    doubao_struct_model: str = "doubao-seed-2-0-mini-260215"
    doubao_timeout_seconds: int = 60
    doubao_artifact_ttl_days: int = 14

    # === 上传安全边界 ===
    max_upload_bytes: int = 8 * 1024 * 1024  # 8MB

    # === Pydantic v2 配置 ===
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",   # ✅ 忽略 .env 里多余字段，避免再炸
    )

# === 全局 settings 实例 ===
settings = Settings()
