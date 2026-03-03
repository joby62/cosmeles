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
    model_tier: Optional[Literal["mini", "lite", "pro"]] = None
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
    requested_model_tier: Optional[Literal["mini", "lite", "pro"]] = None
    model: Optional[str] = None
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
    ingredient_name_en: Optional[str] = None
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
    backfilled_from_storage: int = 0
    submitted_to_model: int = 0
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
    ingredient_name_en: Optional[str] = None
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
    ingredient_name_en: Optional[str] = None
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


class ProductRouteMappingScore(BaseModel):
    route_key: str
    route_title: str
    confidence: int = 0
    reason: str = ""


class ProductRouteMappingEvidenceItem(BaseModel):
    ingredient_name_cn: str = ""
    ingredient_name_en: str = ""
    rank: int = 0
    impact: str = ""


class ProductRouteMappingEvidence(BaseModel):
    positive: List[ProductRouteMappingEvidenceItem] = []
    counter: List[ProductRouteMappingEvidenceItem] = []


class ProductRouteMappingResult(BaseModel):
    product_id: str
    category: str
    rules_version: str
    fingerprint: str
    generated_at: str
    prompt_key: str
    prompt_version: str
    model: str
    primary_route: ProductRouteMappingScore
    secondary_route: ProductRouteMappingScore
    route_scores: List[ProductRouteMappingScore] = []
    evidence: ProductRouteMappingEvidence = Field(default_factory=ProductRouteMappingEvidence)
    confidence_reason: str = ""
    needs_review: bool = False
    analysis_text: str = ""
    storage_path: str


class ProductRouteMappingBuildRequest(BaseModel):
    category: Optional[str] = None
    force_regenerate: bool = False
    only_unmapped: bool = False


class ProductRouteMappingBuildItem(BaseModel):
    product_id: str
    category: str
    status: Literal["created", "updated", "skipped", "failed"] = "created"
    primary_route: Optional[ProductRouteMappingScore] = None
    secondary_route: Optional[ProductRouteMappingScore] = None
    route_scores: List[ProductRouteMappingScore] = []
    storage_path: Optional[str] = None
    model: Optional[str] = None
    error: Optional[str] = None


class ProductRouteMappingBuildResponse(BaseModel):
    status: str
    scanned_products: int = 0
    submitted_to_model: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    items: List[ProductRouteMappingBuildItem] = []
    failures: List[str] = []


class ProductRouteMappingDetailResponse(BaseModel):
    status: str
    item: ProductRouteMappingResult


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


class MobileSelectionResolveRequest(BaseModel):
    category: str
    answers: dict[str, str] = Field(default_factory=dict)
    reuse_existing: bool = True


class MobileSelectionChoice(BaseModel):
    key: str
    value: str
    label: str


class MobileSelectionRuleHit(BaseModel):
    rule: str
    effect: str


class MobileSelectionRoute(BaseModel):
    key: str
    title: str


class MobileSelectionLinks(BaseModel):
    product: str
    wiki: str


class MobileSelectionResolveResponse(BaseModel):
    status: str
    session_id: str
    reused: bool = False
    is_pinned: bool = False
    pinned_at: Optional[str] = None
    category: str
    rules_version: str
    route: MobileSelectionRoute
    choices: List[MobileSelectionChoice] = []
    rule_hits: List[MobileSelectionRuleHit] = []
    recommended_product: ProductCard
    links: MobileSelectionLinks
    created_at: str


class MobileSelectionBatchDeleteRequest(BaseModel):
    ids: List[str] = Field(default_factory=list)


class MobileSelectionBatchDeleteResponse(BaseModel):
    status: str
    deleted_ids: List[str] = Field(default_factory=list)
    not_found_ids: List[str] = Field(default_factory=list)
    forbidden_ids: List[str] = Field(default_factory=list)


class MobileSelectionPinRequest(BaseModel):
    pinned: bool = True


class MobileCompareCategoryItem(BaseModel):
    key: str
    label: str
    enabled: bool = True


class MobileCompareProfileBootstrap(BaseModel):
    has_history_profile: bool = False
    basis: Literal["none", "latest", "pinned"] = "none"
    can_skip: bool = False
    last_completed_at: Optional[str] = None
    summary: List[str] = Field(default_factory=list)


class MobileCompareRecommendationBootstrap(BaseModel):
    exists: bool = False
    session_id: Optional[str] = None
    route_title: Optional[str] = None
    product: Optional[ProductCard] = None


class MobileCompareLibraryProductItem(BaseModel):
    product: ProductCard
    is_recommendation: bool = False
    is_most_used: bool = False
    usage_count: int = 0


class MobileCompareProductLibrary(BaseModel):
    recommendation_product_id: Optional[str] = None
    most_used_product_id: Optional[str] = None
    items: List[MobileCompareLibraryProductItem] = Field(default_factory=list)


class MobileCompareSourceGuide(BaseModel):
    title: str
    value_points: List[str] = Field(default_factory=list)


class MobileCompareBootstrapResponse(BaseModel):
    status: str
    trace_id: str
    categories: List[MobileCompareCategoryItem] = Field(default_factory=list)
    selected_category: str
    profile: MobileCompareProfileBootstrap
    recommendation: MobileCompareRecommendationBootstrap
    product_library: MobileCompareProductLibrary
    source_guide: MobileCompareSourceGuide


class MobileCompareUploadResponse(BaseModel):
    status: str
    trace_id: str
    upload_id: str
    category: str
    image_path: Optional[str] = None
    created_at: str


class MobileCompareJobTargetInput(BaseModel):
    source: Literal["upload_new", "history_product"] = "upload_new"
    upload_id: Optional[str] = None
    product_id: Optional[str] = None


class MobileCompareJobOptions(BaseModel):
    language: str = "zh-CN"
    include_inci_order_diff: bool = True
    include_function_rank_diff: bool = True


class MobileCompareJobRequest(BaseModel):
    category: str
    profile_mode: Literal["reuse_latest"] = "reuse_latest"
    profile_answers: dict[str, str] = Field(default_factory=dict)
    targets: List[MobileCompareJobTargetInput] = Field(default_factory=list)
    options: MobileCompareJobOptions = Field(default_factory=MobileCompareJobOptions)


class MobileComparePersonalization(BaseModel):
    status: str
    basis: str
    missing_fields: List[str] = Field(default_factory=list)


class MobileCompareVerdict(BaseModel):
    decision: Literal["keep", "switch", "hybrid"]
    headline: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class MobileCompareResultSection(BaseModel):
    key: str
    title: str
    items: List[str] = Field(default_factory=list)


class MobileCompareIngredientOrderDiff(BaseModel):
    ingredient: str
    current_rank: int
    recommended_rank: int


class MobileCompareFunctionRankDiff(BaseModel):
    function: str
    current_score: float
    recommended_score: float


class MobileCompareIngredientDiff(BaseModel):
    overlap: List[str] = Field(default_factory=list)
    only_current: List[str] = Field(default_factory=list)
    only_recommended: List[str] = Field(default_factory=list)
    inci_order_diff: List[MobileCompareIngredientOrderDiff] = Field(default_factory=list)
    function_rank_diff: List[MobileCompareFunctionRankDiff] = Field(default_factory=list)


class MobileCompareTransparency(BaseModel):
    model: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    missing_fields: List[str] = Field(default_factory=list)


class MobileCompareTargetProduct(BaseModel):
    target_id: str
    source: Literal["upload_new", "history_product"]
    brand: Optional[str] = None
    name: Optional[str] = None
    one_sentence: Optional[str] = None


class MobileComparePairResult(BaseModel):
    pair_key: str
    left_target_id: str
    right_target_id: str
    left_title: str
    right_title: str
    verdict: MobileCompareVerdict
    sections: List[MobileCompareResultSection] = Field(default_factory=list)
    ingredient_diff: MobileCompareIngredientDiff


class MobileCompareOverallVerdict(BaseModel):
    decision: Literal["keep", "switch", "hybrid"]
    headline: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    summary_items: List[str] = Field(default_factory=list)


class MobileCompareResultResponse(BaseModel):
    status: str
    trace_id: str
    compare_id: str
    category: str
    personalization: MobileComparePersonalization
    verdict: MobileCompareVerdict
    sections: List[MobileCompareResultSection] = Field(default_factory=list)
    ingredient_diff: MobileCompareIngredientDiff
    transparency: MobileCompareTransparency
    recommendation: MobileSelectionResolveResponse
    current_product: ProductDoc
    recommended_product: ProductDoc
    products: List[MobileCompareTargetProduct] = Field(default_factory=list)
    pair_results: List[MobileComparePairResult] = Field(default_factory=list)
    overall: Optional[MobileCompareOverallVerdict] = None
    created_at: str


class MobileCompareEventRequest(BaseModel):
    name: str
    props: dict[str, Any] = Field(default_factory=dict)
