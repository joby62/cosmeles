from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer, String, Text

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


class MobileSelectionSession(Base):
    __tablename__ = "mobile_selection_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    rules_version: Mapped[str] = mapped_column(String(32), index=True)
    answers_hash: Mapped[str] = mapped_column(String(64), index=True)
    route_key: Mapped[str] = mapped_column(String(128), index=True)
    route_title: Mapped[str] = mapped_column(String(256))
    product_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    answers_json: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(32), index=True)
