from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Boolean, Integer, String, Text, Index

class Base(DeclarativeBase):
    pass

class ProductIndex(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    brand: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    one_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)

    tags_json: Mapped[str] = mapped_column(Text, default="[]")   # JSON string
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    json_path: Mapped[str] = mapped_column(Text)

    created_at: Mapped[str] = mapped_column(String(32), index=True)


class IngredientLibraryIndex(Base):
    __tablename__ = "ingredient_library_index"

    # 稳定 ID：ing-<sha1(category::normalized_ingredient)>
    ingredient_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    ingredient_name: Mapped[str] = mapped_column(String(256))
    ingredient_key: Mapped[str] = mapped_column(String(256), index=True)

    # pending | ready | failed
    status: Mapped[str] = mapped_column(String(32), index=True, default="pending")
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    source_trace_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    hit_count: Mapped[int] = mapped_column(Integer, default=0)

    first_seen_at: Mapped[str] = mapped_column(String(32), index=True)
    last_seen_at: Mapped[str] = mapped_column(String(32), index=True)
    last_generated_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class IngredientLibraryAlias(Base):
    __tablename__ = "ingredient_library_alias_index"
    __table_args__ = (
        Index("ix_ing_alias_lookup", "category", "alias_key"),
        Index("ix_ing_alias_target", "ingredient_id"),
    )

    alias_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    alias_key: Mapped[str] = mapped_column(String(256), index=True)
    alias_name: Mapped[str] = mapped_column(String(256))
    ingredient_id: Mapped[str] = mapped_column(String(64), index=True)
    confidence: Mapped[int] = mapped_column(Integer, default=100)
    resolver: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)


class IngredientLibraryRedirect(Base):
    __tablename__ = "ingredient_library_redirects"
    __table_args__ = (
        Index("ix_ing_redirect_scope", "category", "new_ingredient_id"),
    )

    old_ingredient_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    new_ingredient_id: Mapped[str] = mapped_column(String(64), index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)


class IngredientLibraryBuildJob(Base):
    __tablename__ = "ingredient_library_build_jobs"
    __table_args__ = (
        Index("ix_ing_lib_build_jobs_scope", "status", "category", "updated_at"),
    )

    job_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), index=True, default="queued")
    category: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    force_regenerate: Mapped[bool] = mapped_column(Boolean, default=False)
    max_sources_per_ingredient: Mapped[int] = mapped_column(Integer, default=8)

    stage: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    stage_label: Mapped[str | None] = mapped_column(String(256), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    percent: Mapped[int] = mapped_column(Integer, default=0)
    current_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_ingredient_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    current_ingredient_name: Mapped[str | None] = mapped_column(String(256), nullable=True)

    scanned_products: Mapped[int] = mapped_column(Integer, default=0)
    unique_ingredients: Mapped[int] = mapped_column(Integer, default=0)
    backfilled_from_storage: Mapped[int] = mapped_column(Integer, default=0)
    submitted_to_model: Mapped[int] = mapped_column(Integer, default=0)
    created_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)

    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(String(32), index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)
    started_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    finished_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)


class UploadIngestJob(Base):
    __tablename__ = "upload_ingest_jobs"
    __table_args__ = (
        Index("ix_upload_ingest_jobs_scope", "status", "updated_at"),
    )

    job_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), index=True, default="queued")
    stage: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    stage_label: Mapped[str | None] = mapped_column(String(256), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    percent: Mapped[int] = mapped_column(Integer, default=0)

    file_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    source_content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    temp_upload_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    supplement_temp_upload_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_paths_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    category_override: Mapped[str | None] = mapped_column(String(32), nullable=True)
    brand_override: Mapped[str | None] = mapped_column(String(128), nullable=True)
    name_override: Mapped[str | None] = mapped_column(String(256), nullable=True)

    stage1_model_tier: Mapped[str | None] = mapped_column(String(16), nullable=True)
    stage2_model_tier: Mapped[str | None] = mapped_column(String(16), nullable=True)
    stage1_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage2_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    missing_fields_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_view: Mapped[str | None] = mapped_column(String(128), nullable=True)
    models_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifacts_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(String(32), index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)
    started_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    finished_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)


class ProductWorkbenchJob(Base):
    __tablename__ = "product_workbench_jobs"
    __table_args__ = (
        Index("ix_product_workbench_jobs_scope", "job_type", "status", "updated_at"),
    )

    job_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_type: Mapped[str] = mapped_column(String(48), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True, default="queued")

    params_json: Mapped[str] = mapped_column(Text, default="{}")

    stage: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    stage_label: Mapped[str | None] = mapped_column(String(256), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    percent: Mapped[int] = mapped_column(Integer, default=0)
    current_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_item_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    current_item_name: Mapped[str | None] = mapped_column(String(256), nullable=True)

    counters_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    created_at: Mapped[str] = mapped_column(String(32), index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)
    started_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    finished_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)


class AIJob(Base):
    __tablename__ = "ai_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    capability: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    input_json: Mapped[str] = mapped_column(Text)
    output_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    trace_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    prompt_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(String(32), index=True)
    started_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    finished_at: Mapped[str | None] = mapped_column(String(32), nullable=True)


class AIRun(Base):
    __tablename__ = "ai_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(String(36), index=True)
    capability: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)

    prompt_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    request_json: Mapped[str] = mapped_column(Text)
    response_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[str] = mapped_column(String(32), index=True)


class ProductRouteMappingIndex(Base):
    __tablename__ = "product_route_mapping_index"

    product_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    rules_version: Mapped[str] = mapped_column(String(32), index=True)
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)

    # ready | failed
    status: Mapped[str] = mapped_column(String(32), index=True, default="ready")
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    primary_route_key: Mapped[str] = mapped_column(String(128), index=True)
    primary_route_title: Mapped[str] = mapped_column(String(256))
    primary_confidence: Mapped[int] = mapped_column(Integer, default=0, index=True)
    secondary_route_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    secondary_route_title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    secondary_confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scores_json: Mapped[str] = mapped_column(Text, default="[]")
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    prompt_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    last_generated_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class ProductAnalysisIndex(Base):
    __tablename__ = "product_analysis_index"

    product_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    rules_version: Mapped[str] = mapped_column(String(32), index=True)
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)

    status: Mapped[str] = mapped_column(String(32), index=True, default="ready")
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    route_key: Mapped[str] = mapped_column(String(128), index=True, default="")
    route_title: Mapped[str] = mapped_column(String(256), default="")
    headline: Mapped[str] = mapped_column(Text, default="")
    subtype_fit_verdict: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    confidence: Mapped[int] = mapped_column(Integer, default=0, index=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    schema_version: Mapped[str] = mapped_column(String(64), default="")

    prompt_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    last_generated_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class ProductFeaturedSlot(Base):
    __tablename__ = "product_featured_slots"

    category: Mapped[str] = mapped_column(String(32), primary_key=True)
    target_type_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(36), index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)
    updated_by: Mapped[str | None] = mapped_column(String(128), nullable=True)


class MobileSelectionSession(Base):
    __tablename__ = "mobile_selection_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_type: Mapped[str] = mapped_column(String(32), index=True, default="device")
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    rules_version: Mapped[str] = mapped_column(String(32), index=True)
    answers_hash: Mapped[str] = mapped_column(String(64), index=True)
    route_key: Mapped[str] = mapped_column(String(128), index=True)
    route_title: Mapped[str] = mapped_column(String(256))
    product_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    answers_json: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    pinned_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    deleted_at: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    deleted_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), index=True)


class MobileCompareSessionIndex(Base):
    __tablename__ = "mobile_compare_session_index"
    __table_args__ = (
        Index(
            "ix_mobile_compare_session_owner_scope",
            "owner_type",
            "owner_id",
            "category",
            "updated_at",
        ),
    )

    compare_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_type: Mapped[str] = mapped_column(String(32), index=True, default="device")
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True, default="running")
    stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stage_label: Mapped[str | None] = mapped_column(String(256), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    percent: Mapped[int] = mapped_column(Integer, default=0)
    pair_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pair_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)


class MobileCompareUsageStat(Base):
    __tablename__ = "mobile_compare_usage_stats"
    __table_args__ = (
        Index(
            "ix_mobile_compare_usage_owner_category",
            "owner_type",
            "owner_id",
            "category",
            "updated_at",
        ),
    )

    owner_type: Mapped[str] = mapped_column(String(32), primary_key=True, default="device")
    owner_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)


class MobileBagItem(Base):
    __tablename__ = "mobile_bag_items"
    __table_args__ = (
        Index(
            "ix_mobile_bag_owner_scope",
            "owner_type",
            "owner_id",
            "category",
            "updated_at",
        ),
        Index(
            "ix_mobile_bag_owner_product",
            "owner_type",
            "owner_id",
            "product_id",
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_type: Mapped[str] = mapped_column(String(32), index=True, default="device")
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    product_id: Mapped[str] = mapped_column(String(36), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[str] = mapped_column(String(32), index=True)
    updated_at: Mapped[str] = mapped_column(String(32), index=True)
