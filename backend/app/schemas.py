from typing import Any, List, Optional, Literal, Annotated
from pydantic import BaseModel, Field, ConfigDict

RiskLevel = Literal["low", "mid", "high"]
IngredientAbundanceLevel = Literal["major", "trace"]

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
    rank: Optional[int] = Field(default=None, ge=1)
    abundance_level: Optional[IngredientAbundanceLevel] = None
    order_confidence: Optional[int] = Field(default=None, ge=0, le=100)

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

class ProductRouteMappingIndexItem(BaseModel):
    product_id: str
    category: str
    status: str
    primary_route_key: str
    primary_route_title: str
    primary_confidence: int = 0
    secondary_route_key: Optional[str] = None
    secondary_route_title: Optional[str] = None
    secondary_confidence: Optional[int] = None
    needs_review: bool = False
    rules_version: str
    last_generated_at: Optional[str] = None

class ProductRouteMappingIndexListResponse(BaseModel):
    status: str
    category: Optional[str] = None
    total: int = 0
    items: List[ProductRouteMappingIndexItem] = []

class ProductFeaturedSlotItem(BaseModel):
    category: str
    target_type_key: str
    product_id: str
    updated_at: str
    updated_by: Optional[str] = None

class ProductFeaturedSlotListResponse(BaseModel):
    status: str
    category: Optional[str] = None
    total: int = 0
    items: List[ProductFeaturedSlotItem] = []

class ProductFeaturedSlotUpsertRequest(BaseModel):
    category: str
    target_type_key: str
    product_id: str
    updated_by: Optional[str] = None

class ProductFeaturedSlotClearRequest(BaseModel):
    category: str
    target_type_key: str

class ProductFeaturedSlotClearResponse(BaseModel):
    status: str
    category: str
    target_type_key: str
    deleted: bool = False

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


class ProductWorkbenchJobError(BaseModel):
    code: str = ""
    detail: str = ""
    http_status: int = 500


class ProductWorkbenchJobCounters(BaseModel):
    scanned_products: int = 0
    submitted_to_model: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    compared_pairs: int = 0
    suggestions: int = 0


class ProductWorkbenchJobView(BaseModel):
    status: Literal["queued", "running", "cancelling", "cancelled", "done", "failed"] = "queued"
    job_id: str
    job_type: Literal["route_mapping_build", "product_analysis_build", "dedup_suggest", "selection_result_build"]
    params: dict[str, Any] = Field(default_factory=dict)
    stage: Optional[str] = None
    stage_label: Optional[str] = None
    message: Optional[str] = None
    percent: int = Field(default=0, ge=0, le=100)
    current_index: Optional[int] = None
    current_total: Optional[int] = None
    current_item_id: Optional[str] = None
    current_item_name: Optional[str] = None
    counters: ProductWorkbenchJobCounters = Field(default_factory=ProductWorkbenchJobCounters)
    logs: List[str] = []
    result: Optional[dict[str, Any]] = None
    error: Optional[ProductWorkbenchJobError] = None
    cancel_requested: bool = False
    created_at: str
    updated_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


class ProductWorkbenchJobCancelResponse(BaseModel):
    status: str
    job: ProductWorkbenchJobView


class IngredientLibraryBuildRequest(BaseModel):
    category: Optional[str] = None
    force_regenerate: bool = False
    max_sources_per_ingredient: int = Field(default=8, ge=1, le=30)
    normalization_packages: List[str] = []


class IngredientLibraryNormalizationPackage(BaseModel):
    id: str
    label: str
    description: str
    default_enabled: bool = True
    mode: Literal["auto_merge", "proposal"] = "auto_merge"


class IngredientLibraryMergeCandidate(BaseModel):
    category: str
    canonical_key: str
    canonical_name: str
    merged_names: List[str] = []
    source_product_count: int = 0
    mention_count: int = 0
    confidence: int = 0
    triggered_by: List[str] = []


class IngredientLibraryPreflightSummary(BaseModel):
    scanned_products: int = 0
    total_mentions: int = 0
    raw_unique_ingredients: int = 0
    unique_ingredients_after: int = 0
    merged_delta: int = 0
    merged_groups: int = 0
    unresolved_conflicts: int = 0


class IngredientLibraryPreflightUsageTopItem(BaseModel):
    category: str
    ingredient_id: str
    ingredient_key: str
    ingredient_name: str
    ingredient_name_en: Optional[str] = None
    mention_count: int = 0
    source_product_count: int = 0


class IngredientLibraryPreflightRequest(BaseModel):
    category: Optional[str] = None
    normalization_packages: List[str] = []
    max_merge_preview: int = Field(default=120, ge=10, le=1000)
    max_sources_per_ingredient: int = Field(default=8, ge=1, le=30)


class IngredientLibraryPreflightResponse(BaseModel):
    status: str
    category: Optional[str] = None
    available_packages: List[IngredientLibraryNormalizationPackage] = []
    selected_packages: List[str] = []
    summary: IngredientLibraryPreflightSummary = Field(default_factory=IngredientLibraryPreflightSummary)
    new_merges: List[IngredientLibraryMergeCandidate] = []
    usage_top: List[IngredientLibraryPreflightUsageTopItem] = []
    warnings: List[str] = []


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


class IngredientLibraryBuildJobCreateRequest(BaseModel):
    category: Optional[str] = None
    force_regenerate: bool = False
    max_sources_per_ingredient: int = Field(default=8, ge=1, le=30)
    normalization_packages: List[str] = []


class IngredientLibraryBuildJobError(BaseModel):
    code: str = ""
    detail: str = ""
    http_status: int = 500


class IngredientLibraryBuildJobCounters(BaseModel):
    scanned_products: int = 0
    unique_ingredients: int = 0
    backfilled_from_storage: int = 0
    submitted_to_model: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0


class IngredientLibraryBuildJobView(BaseModel):
    status: Literal["queued", "running", "cancelling", "cancelled", "done", "failed"] = "queued"
    job_id: str
    category: Optional[str] = None
    force_regenerate: bool = False
    max_sources_per_ingredient: int = 8
    normalization_packages: List[str] = []
    stage: Optional[str] = None
    stage_label: Optional[str] = None
    message: Optional[str] = None
    percent: int = Field(default=0, ge=0, le=100)
    current_index: Optional[int] = None
    current_total: Optional[int] = None
    current_ingredient_id: Optional[str] = None
    current_ingredient_name: Optional[str] = None
    live_text: Optional[str] = None
    counters: IngredientLibraryBuildJobCounters = Field(default_factory=IngredientLibraryBuildJobCounters)
    result: Optional[IngredientLibraryBuildResponse] = None
    error: Optional[IngredientLibraryBuildJobError] = None
    cancel_requested: bool = False
    created_at: str
    updated_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


class IngredientLibraryBuildJobCancelResponse(BaseModel):
    status: str
    job: IngredientLibraryBuildJobView


class UploadIngestJobError(BaseModel):
    code: str = ""
    detail: str = ""
    http_status: int = 500


class UploadIngestJobView(BaseModel):
    status: Literal["queued", "running", "waiting_more", "cancelling", "cancelled", "done", "failed"] = "queued"
    job_id: str
    file_name: Optional[str] = None
    source_content_type: Optional[str] = None
    stage: Optional[str] = None
    stage_label: Optional[str] = None
    message: Optional[str] = None
    percent: int = Field(default=0, ge=0, le=100)
    image_path: Optional[str] = None
    image_paths: List[str] = []
    has_primary_temp_preview: bool = False
    has_supplement_temp_preview: bool = False
    temp_preview_url: Optional[str] = None
    supplement_temp_preview_url: Optional[str] = None
    can_retry: bool = False
    can_resume: bool = False
    artifact_context_lost: bool = False
    artifact_context_detail: Optional[str] = None
    category_override: Optional[str] = None
    brand_override: Optional[str] = None
    name_override: Optional[str] = None
    stage1_model_tier: Optional[Literal["mini", "lite", "pro"]] = None
    stage2_model_tier: Optional[Literal["mini", "lite", "pro"]] = None
    stage1_text: Optional[str] = None
    stage2_text: Optional[str] = None
    missing_fields: List[str] = []
    required_view: Optional[str] = None
    models: Optional[dict[str, Any]] = None
    artifacts: Optional[dict[str, Any]] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[UploadIngestJobError] = None
    cancel_requested: bool = False
    created_at: str
    updated_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


class UploadIngestJobCancelResponse(BaseModel):
    status: str
    job: UploadIngestJobView


class IngredientLibraryDeleteFailureItem(BaseModel):
    ingredient_id: str
    error: str


class IngredientLibraryBatchDeleteRequest(BaseModel):
    ingredient_ids: List[str] = []
    remove_doubao_artifacts: bool = True


class IngredientLibraryBatchDeleteResponse(BaseModel):
    status: str
    deleted_ids: List[str] = []
    missing_ids: List[str] = []
    failed_items: List[IngredientLibraryDeleteFailureItem] = []
    removed_files: int = 0
    removed_dirs: int = 0


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
    source_json: dict[str, Any] = Field(default_factory=dict)
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


ProductAnalysisCategory = Literal["shampoo", "bodywash", "conditioner", "lotion", "cleanser"]
ProductAnalysisSubtypeFitVerdict = Literal["strong_fit", "fit_with_limits", "weak_fit", "mismatch"]
ProductAnalysisMissingCode = Literal[
    "route_support_missing",
    "evidence_too_sparse",
    "active_strength_unclear",
    "ingredient_order_unclear",
    "formula_signal_conflict",
    "ingredient_library_absent",
    "summary_signal_too_weak",
]


class StrictSchemaModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProductAnalysisContextProduct(StrictSchemaModel):
    product_id: str
    category: ProductAnalysisCategory
    brand: str = ""
    name: str = ""
    one_sentence: str = ""


class ProductAnalysisContextRouteMapping(StrictSchemaModel):
    primary_route_key: str
    primary_route_title: str
    primary_confidence: int = Field(..., ge=0, le=100)
    secondary_route_key: str = ""
    secondary_route_title: str = ""
    secondary_confidence: int = Field(default=0, ge=0, le=100)


class ProductAnalysisContextSummary(StrictSchemaModel):
    one_sentence: str = ""
    pros: List[str]
    cons: List[str]
    who_for: List[str]
    who_not_for: List[str]


class ProductAnalysisContextIngredientCompact(StrictSchemaModel):
    rank: int = Field(..., ge=1)
    ingredient_name_cn: str = ""
    ingredient_name_en: str = ""
    type: str = ""
    functions: List[str]
    risk: RiskLevel = "low"
    abundance_level: IngredientAbundanceLevel = "trace"


class ProductAnalysisContextIngredientBrief(StrictSchemaModel):
    ingredient_name_cn: str = ""
    ingredient_name_en: str = ""
    rank: int = Field(..., ge=1)
    why_selected: Literal["top_rank", "route_related", "risk_related"]
    library_summary: str = ""
    benefit_tags: List[str]
    risk_tags: List[str]


class ProductAnalysisContextFormulaSignals(StrictSchemaModel):
    top10_names: List[str]
    function_counts: dict[str, int]
    risk_counts: dict[str, int]
    special_flags: List[str]


class ProductAnalysisContextPayload(StrictSchemaModel):
    product: ProductAnalysisContextProduct
    route_mapping: ProductAnalysisContextRouteMapping
    stage2_summary: ProductAnalysisContextSummary
    ingredients_compact: List[ProductAnalysisContextIngredientCompact]
    salient_ingredient_briefs: List[ProductAnalysisContextIngredientBrief]
    formula_signals: ProductAnalysisContextFormulaSignals


class ProductAnalysisKeyIngredient(StrictSchemaModel):
    ingredient_name_cn: str
    ingredient_name_en: str
    rank: int = Field(..., ge=0)
    role: str
    impact: str


class ProductAnalysisEvidenceItem(StrictSchemaModel):
    ingredient_name_cn: str
    ingredient_name_en: str
    rank: int = Field(..., ge=0)
    impact: str


class ProductAnalysisEvidence(StrictSchemaModel):
    positive: List[ProductAnalysisEvidenceItem]
    counter: List[ProductAnalysisEvidenceItem]
    missing_codes: List[ProductAnalysisMissingCode]


class ProductAnalysisDiagnosticScore(StrictSchemaModel):
    score: int = Field(..., ge=0, le=5)
    reason: str


class ProductAnalysisProfileBase(StrictSchemaModel):
    schema_version: str
    category: ProductAnalysisCategory
    route_key: str
    route_title: str
    headline: str
    positioning_summary: str
    subtype_fit_verdict: ProductAnalysisSubtypeFitVerdict
    subtype_fit_reason: str
    best_for: List[str]
    not_ideal_for: List[str]
    usage_tips: List[str]
    watchouts: List[str]
    key_ingredients: List[ProductAnalysisKeyIngredient]
    evidence: ProductAnalysisEvidence
    confidence: int = Field(..., ge=0, le=100)
    confidence_reason: str
    needs_review: bool


class ShampooProductAnalysisDiagnostics(StrictSchemaModel):
    cleanse_intensity: ProductAnalysisDiagnosticScore
    oil_control_support: ProductAnalysisDiagnosticScore
    dandruff_itch_support: ProductAnalysisDiagnosticScore
    scalp_soothing_support: ProductAnalysisDiagnosticScore
    hair_strengthening_support: ProductAnalysisDiagnosticScore
    moisture_balance_support: ProductAnalysisDiagnosticScore
    daily_use_friendliness: ProductAnalysisDiagnosticScore
    residue_weight: ProductAnalysisDiagnosticScore


class BodywashProductAnalysisDiagnostics(StrictSchemaModel):
    cleanse_intensity: ProductAnalysisDiagnosticScore
    barrier_repair_support: ProductAnalysisDiagnosticScore
    body_acne_support: ProductAnalysisDiagnosticScore
    keratin_softening_support: ProductAnalysisDiagnosticScore
    brightening_support: ProductAnalysisDiagnosticScore
    fragrance_presence: ProductAnalysisDiagnosticScore
    rinse_afterfeel_nourishment: ProductAnalysisDiagnosticScore


class ConditionerProductAnalysisDiagnostics(StrictSchemaModel):
    detangling_support: ProductAnalysisDiagnosticScore
    anti_frizz_support: ProductAnalysisDiagnosticScore
    airy_light_support: ProductAnalysisDiagnosticScore
    repair_density: ProductAnalysisDiagnosticScore
    color_lock_support: ProductAnalysisDiagnosticScore
    basic_hydration_support: ProductAnalysisDiagnosticScore
    fine_hair_burden: ProductAnalysisDiagnosticScore


class LotionProductAnalysisDiagnostics(StrictSchemaModel):
    light_hydration_support: ProductAnalysisDiagnosticScore
    heavy_repair_support: ProductAnalysisDiagnosticScore
    body_acne_support: ProductAnalysisDiagnosticScore
    aha_renew_support: ProductAnalysisDiagnosticScore
    brightening_support: ProductAnalysisDiagnosticScore
    fragrance_presence: ProductAnalysisDiagnosticScore
    occlusive_weight: ProductAnalysisDiagnosticScore


class CleanserProductAnalysisDiagnostics(StrictSchemaModel):
    apg_support: ProductAnalysisDiagnosticScore
    amino_support: ProductAnalysisDiagnosticScore
    soap_blend_strength: ProductAnalysisDiagnosticScore
    bha_support: ProductAnalysisDiagnosticScore
    clay_support: ProductAnalysisDiagnosticScore
    enzyme_support: ProductAnalysisDiagnosticScore
    barrier_friendliness: ProductAnalysisDiagnosticScore
    makeup_residue_support: ProductAnalysisDiagnosticScore


class ShampooProductAnalysisResult(ProductAnalysisProfileBase):
    schema_version: Literal["product_profile_shampoo.v1"]
    category: Literal["shampoo"]
    diagnostics: ShampooProductAnalysisDiagnostics


class BodywashProductAnalysisResult(ProductAnalysisProfileBase):
    schema_version: Literal["product_profile_bodywash.v1"]
    category: Literal["bodywash"]
    diagnostics: BodywashProductAnalysisDiagnostics


class ConditionerProductAnalysisResult(ProductAnalysisProfileBase):
    schema_version: Literal["product_profile_conditioner.v1"]
    category: Literal["conditioner"]
    diagnostics: ConditionerProductAnalysisDiagnostics


class LotionProductAnalysisResult(ProductAnalysisProfileBase):
    schema_version: Literal["product_profile_lotion.v1"]
    category: Literal["lotion"]
    diagnostics: LotionProductAnalysisDiagnostics


class CleanserProductAnalysisResult(ProductAnalysisProfileBase):
    schema_version: Literal["product_profile_cleanser.v1"]
    category: Literal["cleanser"]
    diagnostics: CleanserProductAnalysisDiagnostics


ProductAnalysisResult = Annotated[
    ShampooProductAnalysisResult
    | BodywashProductAnalysisResult
    | ConditionerProductAnalysisResult
    | LotionProductAnalysisResult
    | CleanserProductAnalysisResult
    ,
    Field(discriminator="category"),
]


class ProductAnalysisStoredResult(StrictSchemaModel):
    product_id: str
    category: ProductAnalysisCategory
    rules_version: str
    fingerprint: str
    generated_at: str
    prompt_key: str
    prompt_version: str
    model: str
    profile: ProductAnalysisResult
    storage_path: str


class ProductAnalysisIndexItem(BaseModel):
    product_id: str
    category: ProductAnalysisCategory
    status: str
    route_key: str = ""
    route_title: str = ""
    headline: str = ""
    subtype_fit_verdict: Optional[ProductAnalysisSubtypeFitVerdict] = None
    confidence: int = 0
    needs_review: bool = False
    schema_version: str = ""
    rules_version: str = ""
    last_generated_at: Optional[str] = None


class ProductAnalysisIndexListResponse(BaseModel):
    status: str
    category: Optional[str] = None
    total: int = 0
    items: List[ProductAnalysisIndexItem] = []


class ProductAnalysisBuildRequest(BaseModel):
    category: Optional[str] = None
    force_regenerate: bool = False
    only_unanalyzed: bool = False


class ProductAnalysisBuildItem(BaseModel):
    product_id: str
    category: str
    status: Literal["created", "updated", "skipped", "failed"] = "created"
    route_key: Optional[str] = None
    route_title: Optional[str] = None
    headline: Optional[str] = None
    subtype_fit_verdict: Optional[ProductAnalysisSubtypeFitVerdict] = None
    confidence: Optional[int] = None
    needs_review: Optional[bool] = None
    storage_path: Optional[str] = None
    model: Optional[str] = None
    error: Optional[str] = None


class ProductAnalysisBuildResponse(BaseModel):
    status: str
    scanned_products: int = 0
    submitted_to_model: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    items: List[ProductAnalysisBuildItem] = []
    failures: List[str] = []


class ProductAnalysisDetailResponse(BaseModel):
    status: str
    item: ProductAnalysisStoredResult


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


class MobileInvalidProductRefCleanupRequest(BaseModel):
    dry_run: bool = True
    sample_limit: int = Field(default=8, ge=1, le=50)


class MobileInvalidProductRefScopeResult(BaseModel):
    scanned: int = 0
    invalid: int = 0
    repaired: int = 0
    sample_refs: List[str] = []


class MobileInvalidProductRefCleanupResponse(BaseModel):
    status: str
    dry_run: bool
    product_count: int = 0
    total_invalid: int = 0
    total_repaired: int = 0
    selection_sessions: MobileInvalidProductRefScopeResult
    bag_items: MobileInvalidProductRefScopeResult
    compare_usage_stats: MobileInvalidProductRefScopeResult


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


MobileSelectionRecommendationSource = Literal["featured_slot", "route_mapping", "category_fallback"]
MobileSelectionFitLevel = Literal["high", "medium", "low"]
MobileSelectionDesiredLevel = Literal["high", "mid", "low"]


class MobileSelectionLinks(BaseModel):
    product: str
    wiki: str


class MobileSelectionMatrixRouteScore(BaseModel):
    route_key: str
    route_title: str
    score_before_mask: int = 0
    score_after_mask: Optional[int] = None
    is_excluded: bool = False
    rank: int = Field(default=0, ge=0)
    gap_from_best: Optional[int] = None


class MobileSelectionMatrixQuestionRouteDelta(BaseModel):
    route_key: str
    route_title: str
    delta: int = 0


class MobileSelectionMatrixQuestionContribution(BaseModel):
    question_key: str
    question_title: str
    answer_value: str
    answer_label: str
    route_deltas: List[MobileSelectionMatrixQuestionRouteDelta] = Field(default_factory=list)


class MobileSelectionMatrixVetoRoute(BaseModel):
    route_key: str
    route_title: str


class MobileSelectionMatrixTriggeredVeto(BaseModel):
    trigger: str
    note: str = ""
    excluded_routes: List[MobileSelectionMatrixVetoRoute] = Field(default_factory=list)


class MobileSelectionMatrixTopRoute(BaseModel):
    route_key: str
    route_title: str
    score_after_mask: int = 0


class MobileSelectionMatrixAnalysis(BaseModel):
    routes: List[MobileSelectionMatrixRouteScore] = Field(default_factory=list)
    question_contributions: List[MobileSelectionMatrixQuestionContribution] = Field(default_factory=list)
    triggered_vetoes: List[MobileSelectionMatrixTriggeredVeto] = Field(default_factory=list)
    top2: List[MobileSelectionMatrixTopRoute] = Field(default_factory=list)


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
    recommendation_source: MobileSelectionRecommendationSource = "category_fallback"
    matrix_analysis: MobileSelectionMatrixAnalysis = Field(default_factory=MobileSelectionMatrixAnalysis)
    recommended_product: ProductCard
    links: MobileSelectionLinks
    created_at: str


class MobileSelectionFitRationaleItem(BaseModel):
    question_key: str
    question_title: str
    answer_label: str
    route_delta: int = 0
    reason: str


class MobileSelectionProductFitItem(BaseModel):
    diagnostic_key: str
    diagnostic_label: str
    desired_level: MobileSelectionDesiredLevel
    product_score: int = Field(default=0, ge=0, le=5)
    fit_level: MobileSelectionFitLevel = "medium"
    reason: str


class MobileSelectionFitExplanationItem(BaseModel):
    session_id: str
    category: str
    route_key: str
    route_title: str
    recommended_product_id: Optional[str] = None
    recommendation_source: MobileSelectionRecommendationSource = "category_fallback"
    explanation_version: Literal["selection_fit.v1"] = "selection_fit.v1"
    summary_headline: str
    summary_text: str
    matrix_analysis: MobileSelectionMatrixAnalysis = Field(default_factory=MobileSelectionMatrixAnalysis)
    route_rationale: List[MobileSelectionFitRationaleItem] = Field(default_factory=list)
    product_fit: List[MobileSelectionProductFitItem] = Field(default_factory=list)
    matched_points: List[str] = Field(default_factory=list)
    tradeoffs: List[str] = Field(default_factory=list)
    guardrails: List[str] = Field(default_factory=list)
    confidence: int = Field(default=0, ge=0, le=100)
    needs_review: bool = False


class MobileSelectionFitExplanationResponse(BaseModel):
    status: str
    item: MobileSelectionFitExplanationItem


class MobileSelectionResultLookupRequest(BaseModel):
    category: str
    answers: dict[str, str] = Field(default_factory=dict)


MobileSelectionResultSchemaVersion = Literal["selection_result_content.v1", "selection_result_content.v2"]


class MobileSelectionResultBlock(StrictSchemaModel):
    id: str
    kind: str
    version: str
    payload: dict[str, Any] = Field(default_factory=dict)


class MobileSelectionResultCTA(StrictSchemaModel):
    id: str
    label: str
    action: str
    href: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)


class MobileSelectionResultShareCopy(StrictSchemaModel):
    title: str = ""
    subtitle: str = ""
    caption: str = ""


class MobileSelectionResultMeta(StrictSchemaModel):
    prompt_key: str = ""
    prompt_version: str = ""
    model: str = ""
    refresh_reason: str = ""
    raw_storage_path: Optional[str] = None
    published_version_path: str = ""
    generated_at: str


class MobileSelectionResultProductAnalysisSummary(StrictSchemaModel):
    schema_version: str = ""
    headline: str = ""
    positioning_summary: str = ""
    subtype_fit_verdict: str = ""
    subtype_fit_reason: str = ""
    best_for: List[str] = Field(default_factory=list)
    not_ideal_for: List[str] = Field(default_factory=list)
    usage_tips: List[str] = Field(default_factory=list)
    watchouts: List[str] = Field(default_factory=list)
    confidence: int = 0
    confidence_reason: str = ""
    needs_review: bool = False
    evidence_missing_codes: List[str] = Field(default_factory=list)


class MobileSelectionResultIngredientSnapshotItem(StrictSchemaModel):
    ingredient_name_cn: str = ""
    ingredient_name_en: str = ""
    rank: int = 0
    role: str = ""
    impact: str = ""


class MobileSelectionResultContextPayload(StrictSchemaModel):
    category: ProductAnalysisCategory
    category_label: str = ""
    answers_hash: str
    rules_version: str
    answers: dict[str, str] = Field(default_factory=dict)
    choices: List[MobileSelectionChoice] = Field(default_factory=list)
    route: MobileSelectionRoute
    matrix_analysis: MobileSelectionMatrixAnalysis = Field(default_factory=MobileSelectionMatrixAnalysis)
    recommendation_source: MobileSelectionRecommendationSource = "category_fallback"
    recommended_product: ProductCard
    product_analysis_summary: Optional[MobileSelectionResultProductAnalysisSummary] = None
    ingredient_snapshot: List[MobileSelectionResultIngredientSnapshotItem] = Field(default_factory=list)
    product_analysis_fingerprint: Optional[str] = None


class MobileSelectionResultAIContent(StrictSchemaModel):
    schema_version: Literal["selection_result_content.v2"] = "selection_result_content.v2"
    renderer_variant: str = "selection_result_default"
    micro_summary: str = ""
    share_copy: MobileSelectionResultShareCopy = Field(default_factory=MobileSelectionResultShareCopy)
    display_order: List[str] = Field(default_factory=list)
    blocks: List[MobileSelectionResultBlock] = Field(default_factory=list)
    ctas: List[MobileSelectionResultCTA] = Field(default_factory=list)


class MobileSelectionPublishedResult(StrictSchemaModel):
    schema_version: MobileSelectionResultSchemaVersion = "selection_result_content.v1"
    renderer_variant: str
    scenario_id: str
    category: str
    answers_hash: str
    rules_version: str
    route: MobileSelectionRoute
    recommendation_source: MobileSelectionRecommendationSource = "category_fallback"
    recommended_product: ProductCard
    links: MobileSelectionLinks
    micro_summary: str = ""
    share_copy: MobileSelectionResultShareCopy = Field(default_factory=MobileSelectionResultShareCopy)
    display_order: List[str] = Field(default_factory=list)
    blocks: List[MobileSelectionResultBlock] = Field(default_factory=list)
    ctas: List[MobileSelectionResultCTA] = Field(default_factory=list)
    meta: MobileSelectionResultMeta


class MobileSelectionResultResponse(BaseModel):
    status: str
    item: MobileSelectionPublishedResult


class MobileSelectionResultIndexItem(BaseModel):
    scenario_id: str
    category: str
    answers_hash: str
    rules_version: str
    route_key: str
    route_title: str
    status: str
    fingerprint: Optional[str] = None
    renderer_variant: str
    schema_version: str
    recommended_product_id: Optional[str] = None
    product_analysis_fingerprint: Optional[str] = None
    prompt_key: Optional[str] = None
    prompt_version: Optional[str] = None
    model: Optional[str] = None
    raw_storage_path: Optional[str] = None
    storage_path: Optional[str] = None
    published_version_path: Optional[str] = None
    refresh_reason: Optional[str] = None
    generated_at: Optional[str] = None
    updated_at: Optional[str] = None


class MobileSelectionResultPublishRequest(BaseModel):
    category: str
    answers: dict[str, str] = Field(default_factory=dict)
    schema_version: MobileSelectionResultSchemaVersion = "selection_result_content.v1"
    renderer_variant: str = "selection_result_default"
    micro_summary: str = ""
    share_copy: MobileSelectionResultShareCopy = Field(default_factory=MobileSelectionResultShareCopy)
    blocks: List[MobileSelectionResultBlock] = Field(default_factory=list)
    ctas: List[MobileSelectionResultCTA] = Field(default_factory=list)
    display_order: List[str] = Field(default_factory=list)
    fingerprint: Optional[str] = None
    raw_payload: Optional[dict[str, Any]] = None
    prompt_key: str = ""
    prompt_version: str = ""
    model: str = ""
    refresh_reason: str = ""


class MobileSelectionResultPublishResponse(BaseModel):
    status: str
    item: MobileSelectionResultIndexItem


class MobileSelectionResultBuildRequest(BaseModel):
    category: Optional[str] = None
    force_regenerate: bool = False
    only_missing: bool = False


class MobileSelectionResultBuildItem(BaseModel):
    category: str
    answers_hash: str
    route_key: Optional[str] = None
    route_title: Optional[str] = None
    recommended_product_id: Optional[str] = None
    status: Literal["created", "updated", "skipped", "failed"] = "created"
    storage_path: Optional[str] = None
    model: Optional[str] = None
    error: Optional[str] = None


class MobileSelectionResultBuildResponse(BaseModel):
    status: str
    scanned_scenarios: int = 0
    submitted_to_model: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    items: List[MobileSelectionResultBuildItem] = Field(default_factory=list)
    failures: List[str] = Field(default_factory=list)


class MobileSelectionBatchDeleteRequest(BaseModel):
    ids: List[str] = Field(default_factory=list)


class MobileSelectionBatchDeleteResponse(BaseModel):
    status: str
    deleted_ids: List[str] = Field(default_factory=list)
    not_found_ids: List[str] = Field(default_factory=list)
    forbidden_ids: List[str] = Field(default_factory=list)


class MobileSelectionPinRequest(BaseModel):
    pinned: bool = True


class MobileWikiProductItem(BaseModel):
    product: ProductCard
    category_label: str
    target_type_key: Optional[str] = None
    target_type_title: Optional[str] = None
    target_type_level: Literal["subcategory", "category", "unknown"] = "unknown"
    mapping_ready: bool = False
    primary_confidence: Optional[int] = None
    secondary_type_key: Optional[str] = None
    secondary_type_title: Optional[str] = None
    secondary_confidence: Optional[int] = None
    is_featured: bool = False


class MobileWikiCategoryFacet(BaseModel):
    key: str
    label: str
    count: int = 0


class MobileWikiSubtypeFacet(BaseModel):
    key: str
    label: str
    count: int = 0


class MobileWikiProductListResponse(BaseModel):
    status: str
    category: Optional[str] = None
    target_type_key: Optional[str] = None
    query: Optional[str] = None
    total: int = 0
    offset: int = 0
    limit: int = 0
    categories: List[MobileWikiCategoryFacet] = Field(default_factory=list)
    subtypes: List[MobileWikiSubtypeFacet] = Field(default_factory=list)
    items: List[MobileWikiProductItem] = Field(default_factory=list)


class MobileWikiIngredientRef(BaseModel):
    index: int
    name: str
    ingredient_id: Optional[str] = None
    status: Literal["resolved", "unresolved", "conflict"] = "unresolved"
    matched_alias: Optional[str] = None
    reason: Optional[str] = None


class MobileWikiProductDetailItem(BaseModel):
    product: ProductCard
    doc: ProductDoc
    ingredient_refs: List[MobileWikiIngredientRef] = Field(default_factory=list)
    category_label: str
    target_type_key: Optional[str] = None
    target_type_title: Optional[str] = None
    target_type_level: Literal["subcategory", "category", "unknown"] = "unknown"
    mapping_ready: bool = False
    primary_confidence: Optional[int] = None
    secondary_type_key: Optional[str] = None
    secondary_type_title: Optional[str] = None
    secondary_confidence: Optional[int] = None
    is_featured: bool = False


class MobileWikiProductDetailResponse(BaseModel):
    status: str
    item: MobileWikiProductDetailItem


class MobileWikiProductAnalysisResponse(BaseModel):
    status: str
    item: ProductAnalysisStoredResult


class MobileBagUpsertRequest(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=99)


class MobileBagItem(BaseModel):
    item_id: str
    quantity: int = Field(default=1, ge=1, le=99)
    created_at: str
    updated_at: str
    product: ProductCard
    target_type_key: Optional[str] = None
    target_type_title: Optional[str] = None
    target_type_level: Literal["subcategory", "category", "unknown"] = "unknown"
    is_featured: bool = False


class MobileBagListResponse(BaseModel):
    status: str
    category: Optional[str] = None
    total_items: int = 0
    total_quantity: int = 0
    items: List[MobileBagItem] = Field(default_factory=list)


class MobileBagDeleteResponse(BaseModel):
    status: str
    item_id: str
    deleted: bool = False


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
    route_key: Optional[str] = None
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
    user_product_id: Optional[str] = None
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


class MobileClientEventRequest(BaseModel):
    name: str
    props: dict[str, Any] = Field(default_factory=dict)


class MobileAnalyticsFilterState(BaseModel):
    since_hours: Optional[int] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    category: Optional[str] = None
    page: Optional[str] = None
    stage: Optional[str] = None
    error_code: Optional[str] = None
    trigger_reason: Optional[str] = None
    session_id: Optional[str] = None
    compare_id: Optional[str] = None
    owner_id: Optional[str] = None
    limit: Optional[int] = None


class MobileAnalyticsCountItem(BaseModel):
    key: str
    label: str
    count: int = 0
    rate: float = 0.0


class MobileAnalyticsOverviewResponse(BaseModel):
    status: str
    filters: MobileAnalyticsFilterState
    total_events: int = 0
    sessions: int = 0
    owners: int = 0
    wiki_detail_views: int = 0
    cta_expose: int = 0
    cta_click: int = 0
    cta_ctr: float = 0.0
    use_page_views: int = 0
    use_category_clicks: int = 0
    use_to_compare_rate: float = 0.0
    compare_run_start: int = 0
    compare_run_success: int = 0
    compare_completion_rate: float = 0.0
    compare_result_view: int = 0
    result_reach_rate: float = 0.0
    feedback_prompt_show: int = 0
    feedback_submit: int = 0
    feedback_submit_rate: float = 0.0


class MobileAnalyticsFunnelStep(BaseModel):
    step_key: str
    step_label: str
    count: int = 0
    from_prev_rate: float = 0.0
    from_first_rate: float = 0.0


class MobileAnalyticsFunnelResponse(BaseModel):
    status: str
    filters: MobileAnalyticsFilterState
    steps: List[MobileAnalyticsFunnelStep] = Field(default_factory=list)


class MobileAnalyticsStageErrorMatrixItem(BaseModel):
    stage: str
    stage_label: str
    error_code: str
    count: int = 0
    rate: float = 0.0


class MobileAnalyticsStageDurationItem(BaseModel):
    stage: str
    stage_label: str
    samples: int = 0
    avg_seconds: float = 0.0
    p50_seconds: float = 0.0
    p95_seconds: float = 0.0


class MobileAnalyticsErrorsResponse(BaseModel):
    status: str
    filters: MobileAnalyticsFilterState
    compare_run_start: int = 0
    total_errors: int = 0
    by_stage: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    by_error_code: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    stage_error_matrix: List[MobileAnalyticsStageErrorMatrixItem] = Field(default_factory=list)
    stage_duration_estimates: List[MobileAnalyticsStageDurationItem] = Field(default_factory=list)


class MobileAnalyticsFeedbackTextSample(BaseModel):
    event_id: str
    created_at: str
    trigger_reason: Optional[str] = None
    reason_label: Optional[str] = None
    reason_text: Optional[str] = None
    category: Optional[str] = None
    compare_id: Optional[str] = None
    stage: Optional[str] = None
    session_id: Optional[str] = None


class MobileAnalyticsFeedbackMatrixItem(BaseModel):
    trigger_reason: str
    reason_label: str
    count: int = 0
    rate: float = 0.0


class MobileAnalyticsFeedbackResponse(BaseModel):
    status: str
    filters: MobileAnalyticsFilterState
    total_prompts: int = 0
    total_submissions: int = 0
    by_trigger_reason: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    by_reason_label: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    trigger_reason_matrix: List[MobileAnalyticsFeedbackMatrixItem] = Field(default_factory=list)
    recent_text_samples: List[MobileAnalyticsFeedbackTextSample] = Field(default_factory=list)


class MobileAnalyticsPageDepthItem(BaseModel):
    page: str
    depth_percent: int
    count: int = 0
    rate: float = 0.0


class MobileAnalyticsRageClickTargetItem(BaseModel):
    page: str
    target_id: str
    count: int = 0
    rate: float = 0.0


class MobileAnalyticsCtaFollowthroughItem(BaseModel):
    cta: str
    clicks: int = 0
    landings: int = 0
    landing_rate: float = 0.0


class MobileAnalyticsCtaCompletionItem(BaseModel):
    cta: str
    completion_key: str
    completion_label: str
    clicks: int = 0
    landings: int = 0
    completions: int = 0
    completion_rate_from_click: float = 0.0
    completion_rate_from_land: float = 0.0


class MobileAnalyticsExperienceResponse(BaseModel):
    status: str
    filters: MobileAnalyticsFilterState
    wiki_product_list_views: int = 0
    wiki_product_clicks: int = 0
    wiki_product_ctr: float = 0.0
    wiki_ingredient_list_views: int = 0
    wiki_ingredient_clicks: int = 0
    wiki_ingredient_ctr: float = 0.0
    compare_result_views: int = 0
    compare_result_leaves: int = 0
    avg_result_dwell_ms: float = 0.0
    p50_result_dwell_ms: float = 0.0
    result_scroll_75: int = 0
    result_scroll_100: int = 0
    result_scroll_75_rate: float = 0.0
    result_scroll_100_rate: float = 0.0
    stall_detected: int = 0
    rage_clicks: int = 0
    dead_clicks: int = 0
    scroll_depth_by_page: List[MobileAnalyticsPageDepthItem] = Field(default_factory=list)
    stall_by_page: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    rage_click_targets: List[MobileAnalyticsRageClickTargetItem] = Field(default_factory=list)
    dead_click_targets: List[MobileAnalyticsRageClickTargetItem] = Field(default_factory=list)
    result_cta_clicks: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    result_cta_followthrough: List[MobileAnalyticsCtaFollowthroughItem] = Field(default_factory=list)
    result_cta_completions: List[MobileAnalyticsCtaCompletionItem] = Field(default_factory=list)
    browser_families: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    os_families: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    device_types: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    viewport_buckets: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    network_types: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    languages: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    device_memory_buckets: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    cpu_core_buckets: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    touch_points_buckets: List[MobileAnalyticsCountItem] = Field(default_factory=list)
    online_states: List[MobileAnalyticsCountItem] = Field(default_factory=list)


class MobileAnalyticsSessionSummary(BaseModel):
    session_id: str
    owner_label: Optional[str] = None
    category: Optional[str] = None
    compare_id: Optional[str] = None
    started_at: str
    last_event_at: str
    duration_seconds: float = 0.0
    event_count: int = 0
    outcome: str = "browsing"
    latest_page: Optional[str] = None
    latest_error_code: Optional[str] = None
    latest_feedback_reason: Optional[str] = None
    pages: List[str] = Field(default_factory=list)
    events: List[str] = Field(default_factory=list)


class MobileAnalyticsSessionEventItem(BaseModel):
    event_id: str
    created_at: str
    name: str
    page: Optional[str] = None
    route: Optional[str] = None
    category: Optional[str] = None
    compare_id: Optional[str] = None
    stage: Optional[str] = None
    error_code: Optional[str] = None
    detail: Optional[str] = None
    trigger_reason: Optional[str] = None
    reason_label: Optional[str] = None
    dwell_ms: Optional[int] = None


class MobileAnalyticsSessionsResponse(BaseModel):
    status: str
    filters: MobileAnalyticsFilterState
    total: int = 0
    selected_session_id: Optional[str] = None
    selected_compare_id: Optional[str] = None
    items: List[MobileAnalyticsSessionSummary] = Field(default_factory=list)
    timeline: List[MobileAnalyticsSessionEventItem] = Field(default_factory=list)


class MobileCompareSessionResultBrief(BaseModel):
    decision: Optional[Literal["keep", "switch", "hybrid"]] = None
    headline: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    created_at: Optional[str] = None


class MobileCompareSessionError(BaseModel):
    code: str
    detail: str
    http_status: int = 500
    retryable: bool = True
    stage: Optional[str] = None
    stage_label: Optional[str] = None


class MobileCompareSessionResponse(BaseModel):
    status: Literal["running", "done", "failed"] = "running"
    compare_id: str
    category: str
    created_at: str
    updated_at: str
    stage: Optional[str] = None
    stage_label: Optional[str] = None
    message: Optional[str] = None
    percent: int = Field(default=0, ge=0, le=100)
    pair_index: Optional[int] = None
    pair_total: Optional[int] = None
    targets_snapshot: List[MobileCompareJobTargetInput] = Field(default_factory=list)
    result: Optional[MobileCompareSessionResultBrief] = None
    error: Optional[MobileCompareSessionError] = None


class MobileUserProductItem(BaseModel):
    user_product_id: str
    category: str
    brand: Optional[str] = None
    name: Optional[str] = None
    one_sentence: Optional[str] = None
    image_url: Optional[str] = None
    source_upload_id: Optional[str] = None
    status: str
    created_at: str
    updated_at: str
    last_analyzed_at: Optional[str] = None


class MobileUserProductListResponse(BaseModel):
    status: str
    category: Optional[str] = None
    total: int = 0
    offset: int = 0
    limit: int = 0
    items: List[MobileUserProductItem] = Field(default_factory=list)


class MobileCompareBatchDeleteRequest(BaseModel):
    ids: List[str] = Field(default_factory=list)


class MobileCompareBatchDeleteResponse(BaseModel):
    status: str
    deleted_ids: List[str] = Field(default_factory=list)
    not_found_ids: List[str] = Field(default_factory=list)
    forbidden_ids: List[str] = Field(default_factory=list)
    removed_files: int = 0
    removed_dirs: int = 0
