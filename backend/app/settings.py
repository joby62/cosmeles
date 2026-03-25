from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# === 路径基准（backend 目录）===
BACKEND_DIR = Path(__file__).resolve().parents[1]  # backend/
DEFAULT_STORAGE_DIR = BACKEND_DIR / "storage"
DEFAULT_USER_STORAGE_DIR = BACKEND_DIR / "user_storage"

class Settings(BaseSettings):
    # === 基础环境 ===
    app_env: str = "dev"
    deploy_profile: str = "single_node"
    runtime_role: str = "api"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5000,http://127.0.0.1:5000,http://localhost:5001,http://127.0.0.1:5001"
    # 通用跨域兜底：允许任意域名/IP 的开发前端端口（3000/5000/5001）
    cors_origin_regex: str = r"^https?://[a-zA-Z0-9.\-]+(?::(3000|5000|5001))$"
    api_public_origin: str = ""
    api_internal_origin: str = ""
    asset_public_origin: str = ""
    cookie_domain: str = ""

    # === 存储路径（绝对路径，关键）===
    storage_dir: str = str(DEFAULT_STORAGE_DIR)
    user_storage_dir: str = str(DEFAULT_USER_STORAGE_DIR)
    storage_backend: str = "local_fs"
    selection_result_repository_backend: str = "postgres_payload"
    queue_backend: str = "local"
    lock_backend: str = "local"
    cache_backend: str = "none"
    redis_url: str = ""
    redis_namespace: str = "mobile-runtime"
    redis_connect_timeout_seconds: float = 1.0
    redis_socket_timeout_seconds: float = 1.0
    lock_downgrade_to_local_on_error: bool = True
    cache_downgrade_to_none_on_error: bool = True
    asset_object_key_prefix: str = "mobile"
    asset_private_prefixes_csv: str = (
        "user-images/,user-uploads/,user-products/,"
        "user-route-mappings/,user-product-profiles/,user-doubao-runs/,user-compare-results/"
    )
    asset_signed_url_ttl_seconds: int = 900
    asset_signing_secret: str = ""
    asset_signed_url_enforced: bool = False

    # === 数据库 ===
    # SQLite 文件将位于 backend/storage/app.db
    database_url: str = f"sqlite:///{(DEFAULT_STORAGE_DIR / 'app.db').as_posix()}"
    # 连接池（仅对非 sqlite 生效）
    db_pool_size: int = 8
    db_max_overflow: int = 4
    db_pool_timeout_seconds: int = 30
    db_pool_recycle_seconds: int = 1800
    db_pool_pre_ping: bool = True
    db_downgrade_to_sqlite_on_error: bool = True
    db_downgrade_sqlite_url: str = f"sqlite:///{(DEFAULT_STORAGE_DIR / 'app.db').as_posix()}"
    rollout_step: str = "worker"
    rollout_target_step: str = "web"
    rollout_rollback_enabled: bool = True
    rollout_consistency_enforced: bool = True

    # === 豆包配置 ===
    doubao_mode: str = "real"  # sample/mock | real
    ark_api_key: str = ""
    doubao_api_key: str = ""
    doubao_endpoint: str = "https://ark.cn-beijing.volces.com/api/v3"
    doubao_model: str = "doubao-seed-2-0-mini-260215"  # legacy fallback
    doubao_vision_model: str = "doubao-seed-2-0-mini-260215"
    doubao_struct_model: str = "doubao-seed-2-0-mini-260215"
    doubao_lite_model: str = "doubao-seed-2-0-lite-260215"
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
    # 上传分析后台任务并发上限（2C4G 推荐 2）
    upload_ingest_max_concurrency: int = 2
    # 移动端对比任务并发上限（2C4G 推荐 1）
    compare_job_max_concurrency: int = 1
    # worker 轮询 queued upload 任务的间隔（秒）
    worker_poll_interval_seconds: float = 1.0
    # 产品工作台后台任务并发上限（2C4G 推荐 1）
    product_workbench_max_concurrency: int = 1

    # === 移动端地理逆解析（可选）===
    mobile_reverse_geocode_provider: str = ""
    mobile_reverse_geocode_key: str = ""
    mobile_reverse_geocode_endpoint: str = "https://restapi.amap.com/v3/geocode/regeo"
    mobile_reverse_geocode_timeout_seconds: float = 3.0

    # === Pydantic v2 配置 ===
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",   # ✅ 忽略 .env 里多余字段，避免再炸
    )

# === 全局 settings 实例 ===
settings = Settings()
