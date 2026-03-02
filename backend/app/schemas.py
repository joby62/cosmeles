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
    title_query: Optional[str] = None
    ingredient_hints: List[str] = []
    max_scan_products: int = Field(default=80, ge=1, le=300)
    max_compare_per_product: int = Field(default=6, ge=1, le=20)
    min_confidence: int = Field(default=70, ge=0, le=100)


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
