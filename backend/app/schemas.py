from typing import Any, List, Optional, Literal
from pydantic import BaseModel, Field

RiskLevel = Literal["low", "mid", "high"]

class ProductInfo(BaseModel):
    category: str = Field(..., examples=["shampoo", "bodywash"])
    brand: Optional[str] = None
    name: Optional[str] = None

class Summary(BaseModel):
    one_sentence: str
    pros: List[str] = []
    cons: List[str] = []
    who_for: List[str] = []
    who_not_for: List[str] = []

class Ingredient(BaseModel):
    name: str
    type: str
    functions: List[str] = []
    risk: RiskLevel = "low"
    notes: str = ""

class Evidence(BaseModel):
    image_path: Optional[str] = None
    doubao_raw: Optional[str] = None
    doubao_vision_text: Optional[str] = None
    doubao_pipeline_mode: Optional[str] = None
    doubao_models: Optional[dict[str, str]] = None
    doubao_artifacts: Optional[dict[str, str]] = None

class ProductDoc(BaseModel):
    product: ProductInfo
    summary: Summary
    ingredients: List[Ingredient] = []
    evidence: Evidence

class ProductCard(BaseModel):
    id: str
    category: str
    brand: Optional[str] = None
    name: Optional[str] = None
    one_sentence: Optional[str] = None
    tags: List[str] = []
    image_url: Optional[str] = None
    created_at: str

class ProductUpdateRequest(BaseModel):
    category: Optional[str] = None
    brand: Optional[str] = None
    name: Optional[str] = None
    one_sentence: Optional[str] = None
    tags: Optional[List[str]] = None

class ProductListMeta(BaseModel):
    total: int
    offset: int
    limit: int

class ProductListResponse(BaseModel):
    items: List[ProductCard]
    meta: ProductListMeta

class CategoryCount(BaseModel):
    category: str
    count: int


class ProductDedupSuggestRequest(BaseModel):
    category: Optional[str] = None
    title_query: Optional[str] = None
    ingredient_hints: List[str] = []
    max_scan_products: int = Field(default=200, ge=1, le=500)
    max_compare_per_product: int = Field(default=20, ge=1, le=20)
    compare_batch_size: Optional[int] = Field(default=None, ge=1, le=20)
    min_confidence: int = Field(default=95, ge=0, le=100)


class ProductDedupSuggestion(BaseModel):
    group_id: str
    keep_id: str
    remove_ids: List[str] = []
    confidence: int = 0
    reason: str = ""
    analysis_text: Optional[str] = None
    compared_ids: List[str] = []


class ProductDedupSuggestResponse(BaseModel):
    status: str
    scanned_products: int
    suggestions: List[ProductDedupSuggestion] = []
    involved_products: List[ProductCard] = []
    failures: List[str] = []


class IngredientLibraryBuildRequest(BaseModel):
    category: Optional[str] = None
    force_regenerate: bool = False
    max_sources_per_ingredient: int = Field(default=8, ge=1, le=30)


class IngredientLibraryBuildItem(BaseModel):
    ingredient_id: str
    category: str
    ingredient_name: str
    source_count: int = 0
    source_trace_ids: List[str] = []
    storage_path: Optional[str] = None
    status: Literal["created", "updated", "skipped", "failed"] = "created"
    model: Optional[str] = None
    error: Optional[str] = None


class IngredientLibraryBuildResponse(BaseModel):
    status: str
    scanned_products: int = 0
    unique_ingredients: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    items: List[IngredientLibraryBuildItem] = []
    failures: List[str] = []


class IngredientLibraryListItem(BaseModel):
    ingredient_id: str
    category: str
    ingredient_name: str
    summary: str = ""
    source_count: int = 0
    source_trace_ids: List[str] = []
    generated_at: Optional[str] = None
    storage_path: str


class IngredientLibraryListResponse(BaseModel):
    status: str
    category: Optional[str] = None
    query: Optional[str] = None
    total: int = 0
    offset: int = 0
    limit: int = 0
    items: List[IngredientLibraryListItem] = []


class IngredientLibrarySourceSample(BaseModel):
    trace_id: str = ""
    brand: str = ""
    name: str = ""
    one_sentence: str = ""
    ingredient: dict[str, Any] = Field(default_factory=dict)


class IngredientLibraryProfile(BaseModel):
    summary: str = ""
    benefits: List[str] = []
    risks: List[str] = []
    usage_tips: List[str] = []
    suitable_for: List[str] = []
    avoid_for: List[str] = []
    confidence: int = 0
    reason: str = ""
    analysis_text: str = ""


class IngredientLibraryDetailItem(BaseModel):
    ingredient_id: str
    category: str
    ingredient_name: str
    ingredient_key: Optional[str] = None
    source_count: int = 0
    source_trace_ids: List[str] = []
    source_samples: List[IngredientLibrarySourceSample] = []
    generated_at: Optional[str] = None
    generator: dict[str, Any] = Field(default_factory=dict)
    profile: IngredientLibraryProfile = Field(default_factory=IngredientLibraryProfile)
    storage_path: str


class IngredientLibraryDetailResponse(BaseModel):
    status: str
    item: IngredientLibraryDetailItem


class ProductBatchDeleteRequest(BaseModel):
    ids: List[str] = []
    keep_ids: List[str] = []
    remove_doubao_artifacts: bool = True


class ProductBatchDeleteResponse(BaseModel):
    status: str
    deleted_ids: List[str] = []
    skipped_ids: List[str] = []
    missing_ids: List[str] = []
    removed_files: int = 0
    removed_dirs: int = 0


class OrphanStorageCleanupRequest(BaseModel):
    dry_run: bool = True
    min_age_minutes: int = Field(default=120, ge=0, le=24 * 60 * 7)
    max_delete: int = Field(default=500, ge=1, le=5000)


class OrphanImageCleanupResult(BaseModel):
    scanned_images: int = 0
    kept_images: int = 0
    orphan_images: int = 0
    deleted_images: int = 0
    orphan_paths: List[str] = []
    deleted_paths: List[str] = []


class OrphanRunsCleanupResult(BaseModel):
    scanned_runs: int = 0
    kept_runs: int = 0
    orphan_runs: int = 0
    deleted_runs: int = 0
    deleted_run_files: int = 0
    orphan_run_dirs: List[str] = []
    deleted_run_dirs: List[str] = []


class OrphanStorageCleanupResponse(BaseModel):
    status: str
    dry_run: bool
    min_age_minutes: int
    max_delete: int
    images: OrphanImageCleanupResult
    runs: OrphanRunsCleanupResult


class AIJobCreateRequest(BaseModel):
    capability: str
    input: dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None
    run_immediately: bool = True


class AIJobView(BaseModel):
    id: str
    capability: str
    status: str
    trace_id: Optional[str] = None
    input: dict[str, Any]
    output: Optional[dict[str, Any]] = None
    prompt_key: Optional[str] = None
    prompt_version: Optional[str] = None
    model: Optional[str] = None
    error_code: Optional[str] = None
    error_http_status: Optional[int] = None
    error_message: Optional[str] = None
    created_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


class AIRunView(BaseModel):
    id: str
    job_id: str
    capability: str
    status: str
    prompt_key: Optional[str] = None
    prompt_version: Optional[str] = None
    model: Optional[str] = None
    request: dict[str, Any]
    response: Optional[dict[str, Any]] = None
    latency_ms: Optional[int] = None
    error_code: Optional[str] = None
    error_http_status: Optional[int] = None
    error_message: Optional[str] = None
    created_at: str


class AIMetricsSummaryView(BaseModel):
    capability: Optional[str] = None
    since_hours: int
    window_start: str

    total_jobs: int
    succeeded_jobs: int
    failed_jobs: int
    running_jobs: int
    queued_jobs: int
    success_rate: float

    timeout_failures: int
    timeout_rate: float

    total_runs: int
    succeeded_runs: int
    failed_runs: int
    avg_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[int] = None

    total_estimated_cost: float
    avg_task_cost: Optional[float] = None
    priced_runs: int
    cost_coverage_rate: float
