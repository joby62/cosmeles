from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# === 路径基准（backend 目录）===
BACKEND_DIR = Path(__file__).resolve().parents[1]  # backend/
DEFAULT_STORAGE_DIR = BACKEND_DIR / "storage"

class Settings(BaseSettings):
    # === 基础环境 ===
    app_env: str = "dev"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5000,http://127.0.0.1:5000,http://localhost:5001,http://127.0.0.1:5001"
    # 通用跨域兜底：允许任意域名/IP 的开发前端端口（3000/5000/5001）
    cors_origin_regex: str = r"^https?://[a-zA-Z0-9.\-]+(?::(3000|5000|5001))$"

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
    # 高级文本能力默认走 pro（可按环境变量覆盖）
    doubao_pro_model: str = "doubao-seed-2-0-pro-260215"
    doubao_advanced_text_model: str = ""
    doubao_timeout_seconds: int = 180
    doubao_max_retries: int = 2
    doubao_retry_backoff_seconds: float = 1.5
    doubao_artifact_ttl_days: int = 14
    # 任务成本估算（可选）：
    # AI_COST_PER_RUN_BY_MODEL_JSON='{"doubao-seed-2-0-mini-260215":0.004}'
    ai_cost_per_run_by_model_json: str = ""
    # 按模型 token 单价估算（元 / 百万 tokens）
    # AI_MODEL_PRICING_PER_MTOKEN_JSON='{"doubao-seed-2-0-pro-260215":{"input":3.2,"output":16,"cache_hit":0.64}}'
    ai_model_pricing_per_mtoken_json: str = (
        '{"doubao-seed-2-0-pro-260215":{"input":3.2,"output":16,"cache_hit":0.64},'
        '"doubao-seed-2-0-lite-260215":{"input":0.6,"output":3.6,"cache_hit":0.12},'
        '"doubao-seed-2-0-mini-260215":{"input":0.2,"output":2.0,"cache_hit":0.04}}'
    )

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
