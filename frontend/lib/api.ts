export type Product = {
  id: string;
  category: string;
  brand?: string | null;
  name?: string | null;
  description?: string | null;
  one_sentence?: string | null;
  tags?: string[] | null;
  image_url?: string | null;
  created_at?: string | null;
};

export type ProductListMeta = {
  total: number;
  offset: number;
  limit: number;
};

export type ProductListResponse = {
  items: Product[];
  meta: ProductListMeta;
};

export type ProductDedupSuggestRequest = {
  category?: string;
  title_query?: string;
  ingredient_hints?: string[];
  model_tier?: "mini" | "lite" | "pro";
  max_scan_products?: number;
  max_compare_per_product?: number;
  compare_batch_size?: number;
  min_confidence?: number;
};

export type ProductDedupSuggestion = {
  group_id: string;
  keep_id: string;
  remove_ids: string[];
  confidence: number;
  reason?: string;
  analysis_text?: string | null;
  compared_ids?: string[];
};

export type ProductDedupSuggestResponse = {
  status: string;
  scanned_products: number;
  requested_model_tier?: "mini" | "lite" | "pro" | null;
  model?: string | null;
  suggestions: ProductDedupSuggestion[];
  involved_products: Product[];
  failures: string[];
};

export type ProductWorkbenchJobError = {
  code: string;
  detail: string;
  http_status: number;
};

export type ProductWorkbenchJobCounters = {
  scanned_products: number;
  submitted_to_model: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  compared_pairs: number;
  suggestions: number;
  deleted: number;
  missing: number;
  invalid: number;
  repaired: number;
  removed_files: number;
  removed_dirs: number;
  scanned_images: number;
  orphan_images: number;
  deleted_images: number;
  scanned_runs: number;
  orphan_runs: number;
  deleted_runs: number;
};

export type ProductWorkbenchJob = {
  status: "queued" | "running" | "cancelling" | "cancelled" | "done" | "failed";
  job_id: string;
  job_type:
    | "route_mapping_build"
    | "product_analysis_build"
    | "dedup_suggest"
    | "selection_result_build"
    | "product_batch_delete"
    | "ingredient_batch_delete"
    | "orphan_storage_cleanup"
    | "mobile_invalid_ref_cleanup";
  params: Record<string, unknown>;
  stage?: string | null;
  stage_label?: string | null;
  message?: string | null;
  percent: number;
  current_index?: number | null;
  current_total?: number | null;
  current_item_id?: string | null;
  current_item_name?: string | null;
  counters: ProductWorkbenchJobCounters;
  live_text?: string | null;
  logs: string[];
  result?: Record<string, unknown> | null;
  error?: ProductWorkbenchJobError | null;
  cancel_requested: boolean;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export type ProductWorkbenchJobCancelResponse = {
  status: string;
  job: ProductWorkbenchJob;
};

export type IngredientLibraryBuildRequest = {
  category?: string;
  force_regenerate?: boolean;
  max_sources_per_ingredient?: number;
  normalization_packages?: string[];
};

export type IngredientLibraryNormalizationPackage = {
  id: string;
  label: string;
  description: string;
  default_enabled: boolean;
  mode: "auto_merge" | "proposal";
};

export type IngredientLibraryMergeCandidate = {
  category: string;
  canonical_key: string;
  canonical_name: string;
  merged_names: string[];
  source_product_count: number;
  mention_count: number;
  confidence: number;
  triggered_by: string[];
};

export type IngredientLibraryPreflightSummary = {
  scanned_products: number;
  total_mentions: number;
  raw_unique_ingredients: number;
  unique_ingredients_after: number;
  merged_delta: number;
  merged_groups: number;
  unresolved_conflicts: number;
};

export type IngredientLibraryPreflightUsageTopItem = {
  category: string;
  ingredient_id: string;
  ingredient_key: string;
  ingredient_name: string;
  ingredient_name_en?: string | null;
  mention_count: number;
  source_product_count: number;
};

export type IngredientLibraryPreflightRequest = {
  category?: string;
  normalization_packages?: string[];
  max_merge_preview?: number;
  max_sources_per_ingredient?: number;
};

export type IngredientLibraryPreflightResponse = {
  status: string;
  category?: string | null;
  available_packages: IngredientLibraryNormalizationPackage[];
  selected_packages: string[];
  summary: IngredientLibraryPreflightSummary;
  new_merges: IngredientLibraryMergeCandidate[];
  usage_top: IngredientLibraryPreflightUsageTopItem[];
  warnings: string[];
};

export type IngredientLibraryBuildItem = {
  ingredient_id: string;
  category: string;
  ingredient_name: string;
  ingredient_name_en?: string | null;
  source_count: number;
  source_trace_ids: string[];
  storage_path?: string | null;
  status: "created" | "updated" | "skipped" | "failed";
  model?: string | null;
  error?: string | null;
};

export type IngredientLibraryBuildResponse = {
  status: string;
  scanned_products: number;
  unique_ingredients: number;
  backfilled_from_storage: number;
  submitted_to_model: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: IngredientLibraryBuildItem[];
  failures: string[];
};

export type IngredientLibraryBuildJobCreateRequest = {
  category?: string;
  force_regenerate?: boolean;
  max_sources_per_ingredient?: number;
  normalization_packages?: string[];
};

export type IngredientLibraryBuildJobError = {
  code: string;
  detail: string;
  http_status: number;
};

export type IngredientLibraryBuildJobCounters = {
  scanned_products: number;
  unique_ingredients: number;
  backfilled_from_storage: number;
  submitted_to_model: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

export type IngredientLibraryBuildJob = {
  status: "queued" | "running" | "cancelling" | "cancelled" | "done" | "failed";
  job_id: string;
  category?: string | null;
  force_regenerate: boolean;
  max_sources_per_ingredient: number;
  normalization_packages: string[];
  stage?: string | null;
  stage_label?: string | null;
  message?: string | null;
  percent: number;
  current_index?: number | null;
  current_total?: number | null;
  current_ingredient_id?: string | null;
  current_ingredient_name?: string | null;
  live_text?: string | null;
  counters: IngredientLibraryBuildJobCounters;
  result?: IngredientLibraryBuildResponse | null;
  error?: IngredientLibraryBuildJobError | null;
  cancel_requested: boolean;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export type IngredientLibraryBuildJobCancelResponse = {
  status: string;
  job: IngredientLibraryBuildJob;
};

export type IngredientLibraryBatchDeleteRequest = {
  ingredient_ids: string[];
  remove_doubao_artifacts?: boolean;
};

export type IngredientLibraryDeleteFailureItem = {
  ingredient_id: string;
  error: string;
};

export type IngredientLibraryBatchDeleteResponse = {
  status: string;
  deleted_ids: string[];
  missing_ids: string[];
  failed_items: IngredientLibraryDeleteFailureItem[];
  removed_files: number;
  removed_dirs: number;
};

export type IngredientLibraryListItem = {
  ingredient_id: string;
  category: string;
  ingredient_name: string;
  ingredient_name_en?: string | null;
  summary: string;
  source_count: number;
  source_trace_ids: string[];
  generated_at?: string | null;
  storage_path: string;
};

export type IngredientLibraryListResponse = {
  status: string;
  category?: string | null;
  query?: string | null;
  total: number;
  offset: number;
  limit: number;
  items: IngredientLibraryListItem[];
};

export type IngredientLibrarySourceSample = {
  trace_id: string;
  brand: string;
  name: string;
  one_sentence: string;
  ingredient: Record<string, unknown>;
};

export type IngredientLibraryProfile = {
  summary: string;
  benefits: string[];
  risks: string[];
  usage_tips: string[];
  suitable_for: string[];
  avoid_for: string[];
  confidence: number;
  reason: string;
  analysis_text: string;
};

export type IngredientLibraryDetailItem = {
  ingredient_id: string;
  category: string;
  ingredient_name: string;
  ingredient_name_en?: string | null;
  ingredient_key?: string | null;
  source_count: number;
  source_trace_ids: string[];
  source_samples: IngredientLibrarySourceSample[];
  source_json: Record<string, unknown>;
  generated_at?: string | null;
  generator: Record<string, unknown>;
  profile: IngredientLibraryProfile;
  storage_path: string;
};

export type IngredientLibraryDetailResponse = {
  status: string;
  item: IngredientLibraryDetailItem;
};

export type ProductRouteMappingScore = {
  route_key: string;
  route_title: string;
  confidence: number;
  reason: string;
};

export type ProductRouteMappingEvidenceItem = {
  ingredient_name_cn: string;
  ingredient_name_en: string;
  rank: number;
  impact: string;
};

export type ProductRouteMappingEvidence = {
  positive: ProductRouteMappingEvidenceItem[];
  counter: ProductRouteMappingEvidenceItem[];
};

export type ProductRouteMappingResult = {
  product_id: string;
  category: string;
  rules_version: string;
  fingerprint: string;
  generated_at: string;
  prompt_key: string;
  prompt_version: string;
  model: string;
  primary_route: ProductRouteMappingScore;
  secondary_route: ProductRouteMappingScore;
  route_scores: ProductRouteMappingScore[];
  evidence: ProductRouteMappingEvidence;
  confidence_reason: string;
  needs_review: boolean;
  analysis_text: string;
  storage_path: string;
};

export type ProductRouteMappingBuildRequest = {
  category?: string;
  force_regenerate?: boolean;
  only_unmapped?: boolean;
};

export type ProductRouteMappingBuildItem = {
  product_id: string;
  category: string;
  status: "created" | "updated" | "skipped" | "failed";
  primary_route?: ProductRouteMappingScore | null;
  secondary_route?: ProductRouteMappingScore | null;
  route_scores: ProductRouteMappingScore[];
  storage_path?: string | null;
  model?: string | null;
  error?: string | null;
};

export type ProductRouteMappingBuildResponse = {
  status: string;
  scanned_products: number;
  submitted_to_model: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: ProductRouteMappingBuildItem[];
  failures: string[];
};

export type ProductRouteMappingDetailResponse = {
  status: string;
  item: ProductRouteMappingResult;
};

export type ProductRouteMappingIndexItem = {
  product_id: string;
  category: string;
  status: string;
  primary_route_key: string;
  primary_route_title: string;
  primary_confidence: number;
  secondary_route_key?: string | null;
  secondary_route_title?: string | null;
  secondary_confidence?: number | null;
  needs_review: boolean;
  rules_version: string;
  last_generated_at?: string | null;
};

export type ProductRouteMappingIndexListResponse = {
  status: string;
  category?: string | null;
  total: number;
  items: ProductRouteMappingIndexItem[];
};

export type ProductAnalysisSubtypeFitVerdict =
  | "strong_fit"
  | "fit_with_limits"
  | "weak_fit"
  | "mismatch";

export type ProductAnalysisMissingCode =
  | "route_support_missing"
  | "evidence_too_sparse"
  | "active_strength_unclear"
  | "ingredient_order_unclear"
  | "formula_signal_conflict"
  | "ingredient_library_absent"
  | "summary_signal_too_weak";

export type ProductAnalysisKeyIngredient = {
  ingredient_name_cn: string;
  ingredient_name_en: string;
  rank: number;
  role: string;
  impact: string;
};

export type ProductAnalysisEvidenceItem = {
  ingredient_name_cn: string;
  ingredient_name_en: string;
  rank: number;
  impact: string;
};

export type ProductAnalysisEvidence = {
  positive: ProductAnalysisEvidenceItem[];
  counter: ProductAnalysisEvidenceItem[];
  missing_codes: ProductAnalysisMissingCode[];
};

export type ProductAnalysisDiagnosticScore = {
  score: number;
  reason: string;
};

export type ShampooProductAnalysisDiagnostics = {
  cleanse_intensity: ProductAnalysisDiagnosticScore;
  oil_control_support: ProductAnalysisDiagnosticScore;
  dandruff_itch_support: ProductAnalysisDiagnosticScore;
  scalp_soothing_support: ProductAnalysisDiagnosticScore;
  hair_strengthening_support: ProductAnalysisDiagnosticScore;
  moisture_balance_support: ProductAnalysisDiagnosticScore;
  daily_use_friendliness: ProductAnalysisDiagnosticScore;
  residue_weight: ProductAnalysisDiagnosticScore;
};

export type BodywashProductAnalysisDiagnostics = {
  cleanse_intensity: ProductAnalysisDiagnosticScore;
  barrier_repair_support: ProductAnalysisDiagnosticScore;
  body_acne_support: ProductAnalysisDiagnosticScore;
  keratin_softening_support: ProductAnalysisDiagnosticScore;
  brightening_support: ProductAnalysisDiagnosticScore;
  fragrance_presence: ProductAnalysisDiagnosticScore;
  rinse_afterfeel_nourishment: ProductAnalysisDiagnosticScore;
};

export type ConditionerProductAnalysisDiagnostics = {
  detangling_support: ProductAnalysisDiagnosticScore;
  anti_frizz_support: ProductAnalysisDiagnosticScore;
  airy_light_support: ProductAnalysisDiagnosticScore;
  repair_density: ProductAnalysisDiagnosticScore;
  color_lock_support: ProductAnalysisDiagnosticScore;
  basic_hydration_support: ProductAnalysisDiagnosticScore;
  fine_hair_burden: ProductAnalysisDiagnosticScore;
};

export type LotionProductAnalysisDiagnostics = {
  light_hydration_support: ProductAnalysisDiagnosticScore;
  heavy_repair_support: ProductAnalysisDiagnosticScore;
  body_acne_support: ProductAnalysisDiagnosticScore;
  aha_renew_support: ProductAnalysisDiagnosticScore;
  brightening_support: ProductAnalysisDiagnosticScore;
  fragrance_presence: ProductAnalysisDiagnosticScore;
  occlusive_weight: ProductAnalysisDiagnosticScore;
};

export type CleanserProductAnalysisDiagnostics = {
  apg_support: ProductAnalysisDiagnosticScore;
  amino_support: ProductAnalysisDiagnosticScore;
  soap_blend_strength: ProductAnalysisDiagnosticScore;
  bha_support: ProductAnalysisDiagnosticScore;
  clay_support: ProductAnalysisDiagnosticScore;
  enzyme_support: ProductAnalysisDiagnosticScore;
  barrier_friendliness: ProductAnalysisDiagnosticScore;
  makeup_residue_support: ProductAnalysisDiagnosticScore;
};

export type ProductAnalysisProfileBase = {
  schema_version: string;
  category: "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";
  route_key: string;
  route_title: string;
  headline: string;
  positioning_summary: string;
  subtype_fit_verdict: ProductAnalysisSubtypeFitVerdict;
  subtype_fit_reason: string;
  best_for: string[];
  not_ideal_for: string[];
  usage_tips: string[];
  watchouts: string[];
  key_ingredients: ProductAnalysisKeyIngredient[];
  evidence: ProductAnalysisEvidence;
  confidence: number;
  confidence_reason: string;
  needs_review: boolean;
};

export type ShampooProductAnalysisProfile = ProductAnalysisProfileBase & {
  schema_version: "product_profile_shampoo.v1";
  category: "shampoo";
  diagnostics: ShampooProductAnalysisDiagnostics;
};

export type BodywashProductAnalysisProfile = ProductAnalysisProfileBase & {
  schema_version: "product_profile_bodywash.v1";
  category: "bodywash";
  diagnostics: BodywashProductAnalysisDiagnostics;
};

export type ConditionerProductAnalysisProfile = ProductAnalysisProfileBase & {
  schema_version: "product_profile_conditioner.v1";
  category: "conditioner";
  diagnostics: ConditionerProductAnalysisDiagnostics;
};

export type LotionProductAnalysisProfile = ProductAnalysisProfileBase & {
  schema_version: "product_profile_lotion.v1";
  category: "lotion";
  diagnostics: LotionProductAnalysisDiagnostics;
};

export type CleanserProductAnalysisProfile = ProductAnalysisProfileBase & {
  schema_version: "product_profile_cleanser.v1";
  category: "cleanser";
  diagnostics: CleanserProductAnalysisDiagnostics;
};

export type ProductAnalysisProfile =
  | ShampooProductAnalysisProfile
  | BodywashProductAnalysisProfile
  | ConditionerProductAnalysisProfile
  | LotionProductAnalysisProfile
  | CleanserProductAnalysisProfile;

export type ProductAnalysisStoredResult = {
  product_id: string;
  category: "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";
  rules_version: string;
  fingerprint: string;
  generated_at: string;
  prompt_key: string;
  prompt_version: string;
  model: string;
  profile: ProductAnalysisProfile;
  storage_path: string;
};

export type ProductAnalysisBuildRequest = {
  category?: string;
  force_regenerate?: boolean;
  only_unanalyzed?: boolean;
};

export type ProductAnalysisBuildItem = {
  product_id: string;
  category: string;
  status: "created" | "updated" | "skipped" | "failed";
  route_key?: string | null;
  route_title?: string | null;
  headline?: string | null;
  subtype_fit_verdict?: ProductAnalysisSubtypeFitVerdict | null;
  confidence?: number | null;
  needs_review?: boolean | null;
  storage_path?: string | null;
  model?: string | null;
  error?: string | null;
};

export type ProductAnalysisBuildResponse = {
  status: string;
  scanned_products: number;
  submitted_to_model: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: ProductAnalysisBuildItem[];
  failures: string[];
};

export type ProductAnalysisDetailResponse = {
  status: string;
  item: ProductAnalysisStoredResult;
};

export type ProductAnalysisIndexItem = {
  product_id: string;
  category: string;
  status: string;
  route_key: string;
  route_title: string;
  headline: string;
  subtype_fit_verdict?: ProductAnalysisSubtypeFitVerdict | null;
  confidence: number;
  needs_review: boolean;
  schema_version: string;
  rules_version: string;
  last_generated_at?: string | null;
};

export type ProductAnalysisIndexListResponse = {
  status: string;
  category?: string | null;
  total: number;
  items: ProductAnalysisIndexItem[];
};

export type ProductFeaturedSlotItem = {
  category: string;
  target_type_key: string;
  product_id: string;
  updated_at: string;
  updated_by?: string | null;
};

export type ProductFeaturedSlotListResponse = {
  status: string;
  category?: string | null;
  total: number;
  items: ProductFeaturedSlotItem[];
};

export type ProductBatchDeleteRequest = {
  ids: string[];
  keep_ids?: string[];
  remove_doubao_artifacts?: boolean;
};

export type ProductBatchDeleteResponse = {
  status: string;
  deleted_ids: string[];
  skipped_ids: string[];
  missing_ids: string[];
  removed_files: number;
  removed_dirs: number;
};

export type OrphanStorageCleanupRequest = {
  dry_run?: boolean;
  min_age_minutes?: number;
  max_delete?: number;
};

export type OrphanStorageCleanupResponse = {
  status: string;
  dry_run: boolean;
  min_age_minutes: number;
  max_delete: number;
  images: {
    scanned_images: number;
    kept_images: number;
    orphan_images: number;
    deleted_images: number;
    orphan_paths: string[];
    deleted_paths: string[];
  };
  runs: {
    scanned_runs: number;
    kept_runs: number;
    orphan_runs: number;
    deleted_runs: number;
    deleted_run_files: number;
    orphan_run_dirs: string[];
    deleted_run_dirs: string[];
  };
};

export type MobileInvalidProductRefCleanupRequest = {
  dry_run?: boolean;
  sample_limit?: number;
};

export type MobileInvalidProductRefCleanupScopeResult = {
  scanned: number;
  invalid: number;
  repaired: number;
  sample_refs: string[];
};

export type MobileInvalidProductRefCleanupResponse = {
  status: string;
  dry_run: boolean;
  product_count: number;
  total_invalid: number;
  total_repaired: number;
  selection_sessions: MobileInvalidProductRefCleanupScopeResult;
  bag_items: MobileInvalidProductRefCleanupScopeResult;
  compare_usage_stats: MobileInvalidProductRefCleanupScopeResult;
};

export type ProductDoc = {
  product: {
    category: string;
    brand?: string | null;
    name?: string | null;
  };
  summary: {
    one_sentence: string;
    pros: string[];
    cons: string[];
    who_for: string[];
    who_not_for: string[];
  };
  ingredients: Array<{
    rank?: number | null;
    name: string;
    abundance_level?: "major" | "trace" | null;
    order_confidence?: number | null;
    type: string;
    functions: string[];
    risk: "low" | "mid" | "high";
    notes: string;
  }>;
  evidence: {
    image_path?: string | null;
    doubao_raw?: string | null;
    doubao_vision_text?: string | null;
    doubao_pipeline_mode?: string | null;
    doubao_models?: Record<string, string> | null;
    doubao_artifacts?: Record<string, string> | null;
  };
};

export type AIJobCreateRequest = {
  capability: string;
  input: Record<string, unknown>;
  trace_id?: string;
  run_immediately?: boolean;
};

export type SSEEvent = {
  event: string;
  data: Record<string, unknown>;
};

export type AIJobView = {
  id: string;
  capability: string;
  status: string;
  trace_id?: string | null;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  prompt_key?: string | null;
  prompt_version?: string | null;
  model?: string | null;
  error_code?: string | null;
  error_http_status?: number | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export type AIRunView = {
  id: string;
  job_id: string;
  capability: string;
  status: string;
  prompt_key?: string | null;
  prompt_version?: string | null;
  model?: string | null;
  request: Record<string, unknown>;
  response?: Record<string, unknown> | null;
  latency_ms?: number | null;
  error_code?: string | null;
  error_http_status?: number | null;
  error_message?: string | null;
  created_at: string;
};

export type AIMetricsSummary = {
  capability?: string | null;
  since_hours: number;
  window_start: string;
  total_jobs: number;
  succeeded_jobs: number;
  failed_jobs: number;
  running_jobs: number;
  queued_jobs: number;
  success_rate: number;
  timeout_failures: number;
  timeout_rate: number;
  total_runs: number;
  succeeded_runs: number;
  failed_runs: number;
  avg_latency_ms?: number | null;
  p95_latency_ms?: number | null;
  total_estimated_cost: number;
  avg_task_cost?: number | null;
  priced_runs: number;
  cost_coverage_rate: number;
};

export type MobileAnalyticsQuery = {
  sinceHours?: number;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  page?: string;
  stage?: string;
  errorCode?: string;
  triggerReason?: string;
  sessionId?: string;
  compareId?: string;
  ownerId?: string;
  locationPresence?: string;
  locationTimeZone?: string;
  locationRegion?: string;
  limit?: number;
};

export type MobileAnalyticsFilterState = {
  since_hours?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  category?: string | null;
  page?: string | null;
  stage?: string | null;
  error_code?: string | null;
  trigger_reason?: string | null;
  session_id?: string | null;
  compare_id?: string | null;
  owner_id?: string | null;
  location_presence?: string | null;
  location_time_zone?: string | null;
  location_region?: string | null;
  limit?: number | null;
};

export type MobileAnalyticsCountItem = {
  key: string;
  label: string;
  count: number;
  rate: number;
};

export type MobileAnalyticsOverview = {
  status: string;
  filters: MobileAnalyticsFilterState;
  total_events: number;
  sessions: number;
  owners: number;
  wiki_detail_views: number;
  cta_expose: number;
  cta_click: number;
  cta_ctr: number;
  use_page_views: number;
  use_category_clicks: number;
  use_to_compare_rate: number;
  compare_run_start: number;
  compare_run_success: number;
  compare_completion_rate: number;
  compare_result_view: number;
  result_reach_rate: number;
  feedback_prompt_show: number;
  feedback_submit: number;
  feedback_submit_rate: number;
};

export type MobileAnalyticsFunnelStep = {
  step_key: string;
  step_label: string;
  count: number;
  from_prev_rate: number;
  from_first_rate: number;
};

export type MobileAnalyticsFunnel = {
  status: string;
  filters: MobileAnalyticsFilterState;
  steps: MobileAnalyticsFunnelStep[];
};

export type MobileAnalyticsStageErrorMatrixItem = {
  stage: string;
  stage_label: string;
  error_code: string;
  count: number;
  rate: number;
};

export type MobileAnalyticsStageDurationItem = {
  stage: string;
  stage_label: string;
  samples: number;
  avg_seconds: number;
  p50_seconds: number;
  p95_seconds: number;
};

export type MobileAnalyticsErrors = {
  status: string;
  filters: MobileAnalyticsFilterState;
  compare_run_start: number;
  total_errors: number;
  by_stage: MobileAnalyticsCountItem[];
  by_error_code: MobileAnalyticsCountItem[];
  stage_error_matrix: MobileAnalyticsStageErrorMatrixItem[];
  stage_duration_estimates: MobileAnalyticsStageDurationItem[];
};

export type MobileAnalyticsFeedbackTextSample = {
  event_id: string;
  created_at: string;
  trigger_reason?: string | null;
  reason_label?: string | null;
  reason_text?: string | null;
  category?: string | null;
  compare_id?: string | null;
  stage?: string | null;
  session_id?: string | null;
};

export type MobileAnalyticsFeedbackMatrixItem = {
  trigger_reason: string;
  reason_label: string;
  count: number;
  rate: number;
};

export type MobileAnalyticsFeedback = {
  status: string;
  filters: MobileAnalyticsFilterState;
  total_prompts: number;
  total_submissions: number;
  by_trigger_reason: MobileAnalyticsCountItem[];
  by_reason_label: MobileAnalyticsCountItem[];
  trigger_reason_matrix: MobileAnalyticsFeedbackMatrixItem[];
  recent_text_samples: MobileAnalyticsFeedbackTextSample[];
};

export type MobileAnalyticsPageDepthItem = {
  page: string;
  depth_percent: number;
  count: number;
  rate: number;
};

export type MobileAnalyticsRageClickTargetItem = {
  page: string;
  target_id: string;
  count: number;
  rate: number;
};

export type MobileAnalyticsCtaFollowthroughItem = {
  cta: string;
  clicks: number;
  landings: number;
  landing_rate: number;
};

export type MobileAnalyticsCtaCompletionItem = {
  cta: string;
  completion_key: string;
  completion_label: string;
  clicks: number;
  landings: number;
  completions: number;
  completion_rate_from_click: number;
  completion_rate_from_land: number;
};

export type MobileAnalyticsExperience = {
  status: string;
  filters: MobileAnalyticsFilterState;
  wiki_product_list_views: number;
  wiki_product_clicks: number;
  wiki_product_ctr: number;
  wiki_ingredient_list_views: number;
  wiki_ingredient_clicks: number;
  wiki_ingredient_ctr: number;
  compare_result_views: number;
  compare_result_leaves: number;
  avg_result_dwell_ms: number;
  p50_result_dwell_ms: number;
  result_scroll_75: number;
  result_scroll_100: number;
  result_scroll_75_rate: number;
  result_scroll_100_rate: number;
  stall_detected: number;
  rage_clicks: number;
  dead_clicks: number;
  scroll_depth_by_page: MobileAnalyticsPageDepthItem[];
  stall_by_page: MobileAnalyticsCountItem[];
  rage_click_targets: MobileAnalyticsRageClickTargetItem[];
  dead_click_targets: MobileAnalyticsRageClickTargetItem[];
  result_cta_clicks: MobileAnalyticsCountItem[];
  result_cta_followthrough: MobileAnalyticsCtaFollowthroughItem[];
  result_cta_completions: MobileAnalyticsCtaCompletionItem[];
  browser_families: MobileAnalyticsCountItem[];
  os_families: MobileAnalyticsCountItem[];
  device_types: MobileAnalyticsCountItem[];
  viewport_buckets: MobileAnalyticsCountItem[];
  network_types: MobileAnalyticsCountItem[];
  languages: MobileAnalyticsCountItem[];
  device_memory_buckets: MobileAnalyticsCountItem[];
  cpu_core_buckets: MobileAnalyticsCountItem[];
  touch_points_buckets: MobileAnalyticsCountItem[];
  online_states: MobileAnalyticsCountItem[];
  location_capture_events: number;
  location_capture_sessions: number;
  sessions_with_location: number;
  sessions_without_location: number;
  location_coverage_rate: number;
  location_regions: MobileAnalyticsCountItem[];
  location_time_zones: MobileAnalyticsCountItem[];
  location_accuracy_buckets: MobileAnalyticsCountItem[];
};

export type MobileAnalyticsSessionSummary = {
  session_id: string;
  owner_label?: string | null;
  category?: string | null;
  compare_id?: string | null;
  started_at: string;
  last_event_at: string;
  duration_seconds: number;
  event_count: number;
  outcome: string;
  latest_page?: string | null;
  latest_error_code?: string | null;
  latest_feedback_reason?: string | null;
  latest_location_label?: string | null;
  latest_location_time_zone?: string | null;
  pages: string[];
  events: string[];
};

export type MobileAnalyticsSessionEventItem = {
  event_id: string;
  created_at: string;
  name: string;
  page?: string | null;
  route?: string | null;
  category?: string | null;
  compare_id?: string | null;
  stage?: string | null;
  error_code?: string | null;
  detail?: string | null;
  trigger_reason?: string | null;
  reason_label?: string | null;
  dwell_ms?: number | null;
  location_label?: string | null;
  location_time_zone?: string | null;
};

export type MobileAnalyticsSessions = {
  status: string;
  filters: MobileAnalyticsFilterState;
  total: number;
  selected_session_id?: string | null;
  selected_compare_id?: string | null;
  items: MobileAnalyticsSessionSummary[];
  timeline: MobileAnalyticsSessionEventItem[];
};

export type MobileSelectionCategory = "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

export type MobileSelectionResolveRequest = {
  category: MobileSelectionCategory;
  answers: Record<string, string>;
  reuse_existing?: boolean;
};

export type MobileSelectionChoice = {
  key: string;
  value: string;
  label: string;
};

export type MobileSelectionRuleHit = {
  rule: string;
  effect: string;
};

export type MobileSelectionRecommendationSource =
  | "featured_slot"
  | "route_mapping"
  | "category_fallback";

export type MobileSelectionMatrixRouteScore = {
  route_key: string;
  route_title: string;
  score_before_mask: number;
  score_after_mask?: number | null;
  is_excluded: boolean;
  rank: number;
  gap_from_best?: number | null;
};

export type MobileSelectionMatrixQuestionRouteDelta = {
  route_key: string;
  route_title: string;
  delta: number;
};

export type MobileSelectionMatrixQuestionContribution = {
  question_key: string;
  question_title: string;
  answer_value: string;
  answer_label: string;
  route_deltas: MobileSelectionMatrixQuestionRouteDelta[];
};

export type MobileSelectionMatrixVetoRoute = {
  route_key: string;
  route_title: string;
};

export type MobileSelectionMatrixTriggeredVeto = {
  trigger: string;
  note: string;
  excluded_routes: MobileSelectionMatrixVetoRoute[];
};

export type MobileSelectionMatrixTopRoute = {
  route_key: string;
  route_title: string;
  score_after_mask: number;
};

export type MobileSelectionMatrixAnalysis = {
  routes: MobileSelectionMatrixRouteScore[];
  question_contributions: MobileSelectionMatrixQuestionContribution[];
  triggered_vetoes: MobileSelectionMatrixTriggeredVeto[];
  top2: MobileSelectionMatrixTopRoute[];
};

export type MobileSelectionResolveResponse = {
  status: string;
  session_id: string;
  reused: boolean;
  is_pinned: boolean;
  pinned_at?: string | null;
  category: MobileSelectionCategory;
  rules_version: string;
  route: {
    key: string;
    title: string;
  };
  choices: MobileSelectionChoice[];
  rule_hits: MobileSelectionRuleHit[];
  recommendation_source: MobileSelectionRecommendationSource;
  matrix_analysis: MobileSelectionMatrixAnalysis;
  recommended_product: Product;
  links: {
    product: string;
    wiki: string;
  };
  created_at: string;
};

export type MobileSelectionFitLevel = "high" | "medium" | "low";
export type MobileSelectionDesiredLevel = "high" | "mid" | "low";

export type MobileSelectionFitRationaleItem = {
  question_key: string;
  question_title: string;
  answer_label: string;
  route_delta: number;
  reason: string;
};

export type MobileSelectionProductFitItem = {
  diagnostic_key: string;
  diagnostic_label: string;
  desired_level: MobileSelectionDesiredLevel;
  product_score: number;
  fit_level: MobileSelectionFitLevel;
  reason: string;
};

export type MobileSelectionFitExplanationItem = {
  session_id: string;
  category: string;
  route_key: string;
  route_title: string;
  recommended_product_id?: string | null;
  recommendation_source: MobileSelectionRecommendationSource;
  explanation_version: "selection_fit.v1";
  summary_headline: string;
  summary_text: string;
  matrix_analysis: MobileSelectionMatrixAnalysis;
  route_rationale: MobileSelectionFitRationaleItem[];
  product_fit: MobileSelectionProductFitItem[];
  matched_points: string[];
  tradeoffs: string[];
  guardrails: string[];
  confidence: number;
  needs_review: boolean;
};

export type MobileSelectionFitExplanationResponse = {
  status: string;
  item: MobileSelectionFitExplanationItem;
};

export type MobileSelectionResultBlock = {
  id: string;
  kind: string;
  version: string;
  payload: Record<string, unknown>;
};

export type MobileSelectionResultCTA = {
  id: string;
  label: string;
  action: string;
  href: string;
  payload: Record<string, unknown>;
};

export type MobileSelectionResultShareCopy = {
  title: string;
  subtitle: string;
  caption: string;
};

export type MobileSelectionPublishedResult = {
  schema_version: "selection_result_content.v1" | "selection_result_content.v2";
  renderer_variant: string;
  scenario_id: string;
  category: MobileSelectionCategory;
  answers_hash: string;
  rules_version: string;
  route: {
    key: string;
    title: string;
  };
  recommendation_source: MobileSelectionRecommendationSource;
  recommended_product: Product;
  links: {
    product: string;
    wiki: string;
  };
  micro_summary: string;
  share_copy: MobileSelectionResultShareCopy;
  display_order: string[];
  blocks: MobileSelectionResultBlock[];
  ctas: MobileSelectionResultCTA[];
  meta: {
    prompt_key: string;
    prompt_version: string;
    model: string;
    refresh_reason: string;
    raw_storage_path?: string | null;
    published_version_path: string;
    generated_at: string;
  };
};

export type MobileSelectionResultResponse = {
  status: string;
  item: MobileSelectionPublishedResult;
};

export type MobileSelectionResultBuildRequest = {
  category?: MobileSelectionCategory;
  force_regenerate?: boolean;
  only_missing?: boolean;
};

export type MobileSelectionResultBuildItem = {
  category: MobileSelectionCategory;
  answers_hash: string;
  route_key?: string | null;
  route_title?: string | null;
  recommended_product_id?: string | null;
  status: "created" | "updated" | "skipped" | "failed";
  storage_path?: string | null;
  model?: string | null;
  error?: string | null;
};

export type MobileSelectionResultBuildResponse = {
  status: string;
  scanned_scenarios: number;
  submitted_to_model: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: MobileSelectionResultBuildItem[];
  failures: string[];
};

export type MobileSelectionBatchDeleteRequest = {
  ids: string[];
};

export type MobileSelectionBatchDeleteResponse = {
  status: string;
  deleted_ids: string[];
  not_found_ids: string[];
  forbidden_ids: string[];
};

export type MobileSelectionPinRequest = {
  pinned: boolean;
};

export type MobileWikiProductItem = {
  product: Product;
  category_label: string;
  target_type_key?: string | null;
  target_type_title?: string | null;
  target_type_level: "subcategory" | "category" | "unknown";
  mapping_ready: boolean;
  primary_confidence?: number | null;
  secondary_type_key?: string | null;
  secondary_type_title?: string | null;
  secondary_confidence?: number | null;
  is_featured: boolean;
};

export type MobileWikiFacet = {
  key: string;
  label: string;
  count: number;
};

export type MobileWikiProductListResponse = {
  status: string;
  category?: string | null;
  target_type_key?: string | null;
  query?: string | null;
  total: number;
  offset: number;
  limit: number;
  categories: MobileWikiFacet[];
  subtypes: MobileWikiFacet[];
  items: MobileWikiProductItem[];
};

export type MobileWikiProductDetailResponse = {
  status: string;
  item: MobileWikiProductItem & {
    doc: ProductDoc;
    ingredient_refs: Array<{
      index: number;
      name: string;
      ingredient_id?: string | null;
      status: "resolved" | "unresolved" | "conflict";
      matched_alias?: string | null;
      reason?: string | null;
    }>;
  };
};

export type MobileWikiProductAnalysisResponse = {
  status: string;
  item: ProductAnalysisStoredResult;
};

export type MobileBagItem = {
  item_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  product: Product;
  target_type_key?: string | null;
  target_type_title?: string | null;
  target_type_level: "subcategory" | "category" | "unknown";
  is_featured: boolean;
};

export type MobileBagListResponse = {
  status: string;
  category?: string | null;
  total_items: number;
  total_quantity: number;
  items: MobileBagItem[];
};

export type MobileCompareCategoryItem = {
  key: MobileSelectionCategory;
  label: string;
  enabled: boolean;
};

export type MobileCompareProductLibraryItem = {
  product: Product;
  is_recommendation: boolean;
  is_most_used: boolean;
  usage_count: number;
};

export type MobileCompareBootstrapResponse = {
  status: string;
  trace_id: string;
  categories: MobileCompareCategoryItem[];
  selected_category: MobileSelectionCategory;
  profile: {
    has_history_profile: boolean;
    basis: "none" | "latest" | "pinned";
    can_skip: boolean;
    last_completed_at?: string | null;
    summary: string[];
  };
  recommendation: {
    exists: boolean;
    session_id?: string | null;
    route_key?: string | null;
    route_title?: string | null;
    product?: Product | null;
  };
  product_library: {
    recommendation_product_id?: string | null;
    most_used_product_id?: string | null;
    items: MobileCompareProductLibraryItem[];
  };
  source_guide: {
    title: string;
    value_points: string[];
  };
};

export type MobileCompareUploadResponse = {
  status: string;
  trace_id: string;
  upload_id: string;
  user_product_id?: string | null;
  category: MobileSelectionCategory;
  image_path?: string | null;
  created_at: string;
};

export type MobileUserProductItem = {
  user_product_id: string;
  category: MobileSelectionCategory;
  brand?: string | null;
  name?: string | null;
  one_sentence?: string | null;
  image_url?: string | null;
  source_upload_id?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_analyzed_at?: string | null;
};

export type MobileUserProductListResponse = {
  status: string;
  category?: MobileSelectionCategory | null;
  total: number;
  offset: number;
  limit: number;
  items: MobileUserProductItem[];
};

export type MobileCompareJobTargetInput = {
  source: "upload_new" | "history_product";
  upload_id?: string | null;
  product_id?: string | null;
};

export type MobileCompareJobRequest = {
  category: MobileSelectionCategory;
  profile_mode: "reuse_latest";
  targets: MobileCompareJobTargetInput[];
  options?: {
    language?: string;
    include_inci_order_diff?: boolean;
    include_function_rank_diff?: boolean;
  };
};

export type MobileCompareResultSection = {
  key: "keep_benefits" | "keep_watchouts" | "ingredient_order_diff" | "profile_fit_advice";
  title: string;
  items: string[];
};

export type MobileCompareResult = {
  status: string;
  trace_id: string;
  compare_id: string;
  category: MobileSelectionCategory;
  personalization: {
    status: string;
    basis: string;
    missing_fields: string[];
  };
  verdict: {
    decision: "keep" | "switch" | "hybrid";
    headline: string;
    confidence: number;
  };
  sections: MobileCompareResultSection[];
  ingredient_diff: {
    overlap: string[];
    only_current: string[];
    only_recommended: string[];
    inci_order_diff: Array<{
      ingredient: string;
      current_rank: number;
      recommended_rank: number;
    }>;
    function_rank_diff: Array<{
      function: string;
      current_score: number;
      recommended_score: number;
    }>;
  };
  transparency: {
    model?: string | null;
    warnings: string[];
    missing_fields: string[];
  };
  recommendation: MobileSelectionResolveResponse;
  current_product: ProductDoc;
  recommended_product: ProductDoc;
  products?: Array<{
    target_id: string;
    source: "upload_new" | "history_product";
    brand?: string | null;
    name?: string | null;
    one_sentence?: string | null;
  }>;
  pair_results?: Array<{
    pair_key: string;
    left_target_id: string;
    right_target_id: string;
    left_title: string;
    right_title: string;
    verdict: {
      decision: "keep" | "switch" | "hybrid";
      headline: string;
      confidence: number;
    };
    sections: MobileCompareResultSection[];
    ingredient_diff: {
      overlap: string[];
      only_current: string[];
      only_recommended: string[];
      inci_order_diff: Array<{
        ingredient: string;
        current_rank: number;
        recommended_rank: number;
      }>;
      function_rank_diff: Array<{
        function: string;
        current_score: number;
        recommended_score: number;
      }>;
    };
  }>;
  overall?: {
    decision: "keep" | "switch" | "hybrid";
    headline: string;
    confidence: number;
    summary_items: string[];
  } | null;
  created_at: string;
};

export type MobileCompareSession = {
  status: "running" | "done" | "failed";
  compare_id: string;
  category: MobileSelectionCategory | string;
  created_at: string;
  updated_at: string;
  stage?: string | null;
  stage_label?: string | null;
  message?: string | null;
  percent: number;
  pair_index?: number | null;
  pair_total?: number | null;
  targets_snapshot?: MobileCompareJobTargetInput[];
  result?: {
    decision?: "keep" | "switch" | "hybrid" | null;
    headline?: string | null;
    confidence: number;
    created_at?: string | null;
  } | null;
  error?: {
    code: string;
    detail: string;
    http_status: number;
    retryable: boolean;
    stage?: string | null;
    stage_label?: string | null;
  } | null;
};

export type MobileCompareBatchDeleteRequest = {
  ids: string[];
};

export type MobileCompareBatchDeleteResponse = {
  status: string;
  deleted_ids: string[];
  not_found_ids: string[];
  forbidden_ids: string[];
  removed_files: number;
  removed_dirs: number;
};

function getBaseForFetch(): string {
  // 在浏览器里优先直连后端，避免 /api 重写层在 multipart 上传时吞掉真实错误。
  if (typeof window !== "undefined") {
    const pageProtocol = window.location.protocol;
    const isHttpsPage = pageProtocol === "https:";
    const direct = process.env.NEXT_PUBLIC_API_BASE?.trim();

    // HTTPS 页面下强制走同源，避免 Mixed Content（https 页面请求 http://...）
    // 生产域名场景应由 Next rewrite/Caddy 转发到后端，而不是浏览器直连 :8000。
    if (isHttpsPage) return "";

    if (direct) {
      try {
        const url = new URL(direct);
        const currentHost = window.location.hostname;
        const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
        const isRemotePage = currentHost !== "127.0.0.1" && currentHost !== "localhost";
        // 页面运行在远端 IP/域名时，避免把请求打到本机 loopback 导致 CORS 失败。
        if (isLoopback && isRemotePage) {
          url.hostname = currentHost;
        }
        return url.toString().replace(/\/$/, "");
      } catch {
        return direct.replace(/\/$/, "");
      }
    }
    return "";
  }

  // 在 Next Server/SSR 里：Node fetch 需要绝对 URL
  // 走 nginx 容器名（docker compose 内部 DNS）
  return process.env.INTERNAL_API_BASE || "http://nginx";
}

function parseFilenameFromDisposition(disposition: string | null): string | null {
  const raw = String(disposition || "").trim();
  if (!raw) return null;

  const utf8Match = raw.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = raw.match(/filename\s*=\s*\"?([^\";]+)\"?/i);
  if (plainMatch && plainMatch[1]) return plainMatch[1];
  return null;
}

async function getForwardedServerHeaders(): Promise<Record<string, string>> {
  if (typeof window !== "undefined") return {};
  try {
    const { headers } = await import("next/headers");
    const incoming = await headers();
    const out: Record<string, string> = {};

    const cookie = incoming.get("cookie");
    if (cookie) out.cookie = cookie;

    const deviceId = incoming.get("x-mobile-device-id");
    if (deviceId) out["x-mobile-device-id"] = deviceId;
    return out;
  } catch {
    return {};
  }
}

type ApiReadCacheProfile = "dynamic" | "short" | "medium" | "long";

type ApiFetchInit = RequestInit & {
  cacheProfile?: ApiReadCacheProfile;
  includeOwnerHeaders?: boolean;
  revalidateSeconds?: number;
};

const API_READ_REVALIDATE_SECONDS: Record<Exclude<ApiReadCacheProfile, "dynamic">, number> = {
  short: 30,
  medium: 120,
  long: 600,
};

function resolveApiFetchCacheOptions(
  method: string,
  cacheProfile: ApiReadCacheProfile | undefined,
  revalidateSeconds: number | undefined,
): { cache: RequestCache; next?: { revalidate: number } } {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") {
    return { cache: "no-store" };
  }

  const profile = cacheProfile || "short";
  if (profile === "dynamic") {
    return { cache: "no-store" };
  }

  return {
    cache: "force-cache",
    next: {
      revalidate: revalidateSeconds ?? API_READ_REVALIDATE_SECONDS[profile],
    },
  };
}

async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const base = getBaseForFetch();
  const method = String(init?.method || "GET");
  const includeOwnerHeaders = init?.includeOwnerHeaders ?? true;
  const forwarded = includeOwnerHeaders ? await getForwardedServerHeaders() : {};
  const cacheProfile = init?.cacheProfile;
  const revalidateSeconds = init?.revalidateSeconds;
  const requestInit: RequestInit = { ...(init || {}) };
  delete (requestInit as RequestInit & { cacheProfile?: unknown }).cacheProfile;
  delete (requestInit as RequestInit & { includeOwnerHeaders?: unknown }).includeOwnerHeaders;
  delete (requestInit as RequestInit & { revalidateSeconds?: unknown }).revalidateSeconds;
  const cacheOptions = resolveApiFetchCacheOptions(method, cacheProfile, revalidateSeconds);

  // path 统一要求以 / 开头
  const url = base ? new URL(path, base).toString() : path;
  const headers = new Headers({
    "content-type": "application/json",
    ...forwarded,
  });
  const initHeaders = new Headers(requestInit.headers || {});
  initHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  const res = await fetch(url, {
    ...requestInit,
    ...cacheOptions,
    credentials: "include",
    headers,
  } as RequestInit & { next?: { revalidate: number } });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function fetchProducts(): Promise<Product[]> {
  return apiFetch<Product[]>("/api/products", {
    cacheProfile: "short",
    includeOwnerHeaders: false,
  });
}

export async function fetchAllProducts(): Promise<Product[]> {
  const limit = 200;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const out: Product[] = [];

  while (offset < total) {
    const page = await apiFetch<ProductListResponse>(`/api/products/page?offset=${offset}&limit=${limit}`, {
      cacheProfile: "short",
      includeOwnerHeaders: false,
    });
    out.push(...page.items);
    total = page.meta.total;
    offset += page.meta.limit;
    if (page.items.length === 0) break;
  }

  return out;
}

export async function fetchProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/api/products/${id}`, {
    cacheProfile: "medium",
    includeOwnerHeaders: false,
  });
}

export async function fetchProductDoc(id: string): Promise<ProductDoc> {
  return apiFetch<ProductDoc>(`/api/products/${id}`, {
    cacheProfile: "medium",
    includeOwnerHeaders: false,
  });
}

export async function suggestProductDuplicates(payload: ProductDedupSuggestRequest): Promise<ProductDedupSuggestResponse> {
  return apiFetch<ProductDedupSuggestResponse>("/api/products/dedup/suggest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function suggestProductDuplicatesStream(
  payload: ProductDedupSuggestRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<ProductDedupSuggestResponse> {
  return postSSE<ProductDedupSuggestResponse>(
    "/api/products/dedup/suggest/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
}

export async function createProductDedupJob(payload: ProductDedupSuggestRequest): Promise<ProductWorkbenchJob> {
  return apiFetch<ProductWorkbenchJob>("/api/products/dedup/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProductDedupJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/products/dedup/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listProductDedupJobs(params?: {
  status?: "queued" | "running" | "cancelling" | "cancelled" | "done" | "failed";
  offset?: number;
  limit?: number;
}): Promise<ProductWorkbenchJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/products/dedup/jobs?${query}` : "/api/products/dedup/jobs";
  return apiFetch<ProductWorkbenchJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelProductDedupJob(jobId: string): Promise<ProductWorkbenchJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJobCancelResponse>(`/api/products/dedup/jobs/${encodeURIComponent(value)}/cancel`, {
    method: "POST",
  });
}

export async function retryProductDedupJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/products/dedup/jobs/${encodeURIComponent(value)}/retry`, {
    method: "POST",
  });
}

export async function fetchIngredientLibrary(params?: {
  category?: string;
  q?: string;
  offset?: number;
  limit?: number;
}): Promise<IngredientLibraryListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.q) search.set("q", params.q);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/products/ingredients/library?${query}` : "/api/products/ingredients/library";
  return apiFetch<IngredientLibraryListResponse>(path, {
    cacheProfile: "short",
    includeOwnerHeaders: false,
  });
}

export async function fetchIngredientLibraryItem(
  category: string,
  ingredientId: string,
): Promise<IngredientLibraryDetailResponse> {
  const categoryValue = category.trim();
  const ingredientValue = ingredientId.trim();
  if (!categoryValue || !ingredientValue) {
    throw new Error("category and ingredientId are required.");
  }
  const path = `/api/products/ingredients/library/${encodeURIComponent(categoryValue)}/${encodeURIComponent(ingredientValue)}`;
  return apiFetch<IngredientLibraryDetailResponse>(path, {
    cacheProfile: "long",
    includeOwnerHeaders: false,
  });
}

export async function fetchIngredientLibraryPreflight(
  payload: IngredientLibraryPreflightRequest,
): Promise<IngredientLibraryPreflightResponse> {
  return apiFetch<IngredientLibraryPreflightResponse>("/api/products/ingredients/library/preflight", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function buildIngredientLibraryStream(
  payload: IngredientLibraryBuildRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<IngredientLibraryBuildResponse> {
  return postSSE<IngredientLibraryBuildResponse>(
    "/api/products/ingredients/library/build/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
}

export async function createIngredientLibraryBuildJob(
  payload: IngredientLibraryBuildJobCreateRequest,
): Promise<IngredientLibraryBuildJob> {
  return apiFetch<IngredientLibraryBuildJob>("/api/products/ingredients/library/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchIngredientLibraryBuildJob(jobId: string): Promise<IngredientLibraryBuildJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<IngredientLibraryBuildJob>(`/api/products/ingredients/library/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listIngredientLibraryBuildJobs(params?: {
  status?: "queued" | "running" | "cancelling" | "cancelled" | "done" | "failed";
  category?: string;
  offset?: number;
  limit?: number;
}): Promise<IngredientLibraryBuildJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.category) search.set("category", params.category);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/products/ingredients/library/jobs?${query}` : "/api/products/ingredients/library/jobs";
  return apiFetch<IngredientLibraryBuildJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelIngredientLibraryBuildJob(jobId: string): Promise<IngredientLibraryBuildJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<IngredientLibraryBuildJobCancelResponse>(
    `/api/products/ingredients/library/jobs/${encodeURIComponent(value)}/cancel`,
    { method: "POST" },
  );
}

export async function retryIngredientLibraryBuildJob(jobId: string): Promise<IngredientLibraryBuildJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<IngredientLibraryBuildJob>(`/api/products/ingredients/library/jobs/${encodeURIComponent(value)}/retry`, {
    method: "POST",
  });
}

export async function deleteIngredientLibraryBatch(
  payload: IngredientLibraryBatchDeleteRequest,
): Promise<IngredientLibraryBatchDeleteResponse> {
  return apiFetch<IngredientLibraryBatchDeleteResponse>("/api/products/ingredients/library/batch-delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createIngredientBatchDeleteJob(
  payload: IngredientLibraryBatchDeleteRequest,
): Promise<ProductWorkbenchJob> {
  return apiFetch<ProductWorkbenchJob>("/api/products/ingredients/library/batch-delete/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchIngredientBatchDeleteJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/products/ingredients/library/batch-delete/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listIngredientBatchDeleteJobs(params?: {
  status?: ProductWorkbenchJob["status"];
  offset?: number;
  limit?: number;
}): Promise<ProductWorkbenchJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query
    ? `/api/products/ingredients/library/batch-delete/jobs?${query}`
    : "/api/products/ingredients/library/batch-delete/jobs";
  return apiFetch<ProductWorkbenchJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelIngredientBatchDeleteJob(jobId: string): Promise<ProductWorkbenchJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJobCancelResponse>(
    `/api/products/ingredients/library/batch-delete/jobs/${encodeURIComponent(value)}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function retryIngredientBatchDeleteJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(
    `/api/products/ingredients/library/batch-delete/jobs/${encodeURIComponent(value)}/retry`,
    {
      method: "POST",
    },
  );
}

export async function buildProductRouteMappingStream(
  payload: ProductRouteMappingBuildRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<ProductRouteMappingBuildResponse> {
  return postSSE<ProductRouteMappingBuildResponse>(
    "/api/products/route-mapping/build/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
}

export async function createProductRouteMappingJob(
  payload: ProductRouteMappingBuildRequest,
): Promise<ProductWorkbenchJob> {
  return apiFetch<ProductWorkbenchJob>("/api/products/route-mapping/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProductRouteMappingJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/products/route-mapping/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listProductRouteMappingJobs(params?: {
  status?: "queued" | "running" | "cancelling" | "cancelled" | "done" | "failed";
  offset?: number;
  limit?: number;
}): Promise<ProductWorkbenchJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/products/route-mapping/jobs?${query}` : "/api/products/route-mapping/jobs";
  return apiFetch<ProductWorkbenchJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelProductRouteMappingJob(jobId: string): Promise<ProductWorkbenchJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJobCancelResponse>(
    `/api/products/route-mapping/jobs/${encodeURIComponent(value)}/cancel`,
    { method: "POST" },
  );
}

export async function retryProductRouteMappingJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(
    `/api/products/route-mapping/jobs/${encodeURIComponent(value)}/retry`,
    { method: "POST" },
  );
}

export async function buildMobileSelectionResults(
  payload: MobileSelectionResultBuildRequest,
): Promise<MobileSelectionResultBuildResponse> {
  return apiFetch<MobileSelectionResultBuildResponse>("/api/products/selection-results/build", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createMobileSelectionResultJob(
  payload: MobileSelectionResultBuildRequest,
): Promise<ProductWorkbenchJob> {
  return apiFetch<ProductWorkbenchJob>("/api/products/selection-results/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMobileSelectionResultJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/products/selection-results/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listMobileSelectionResultJobs(params?: {
  status?: "queued" | "running" | "cancelling" | "cancelled" | "done" | "failed";
  offset?: number;
  limit?: number;
}): Promise<ProductWorkbenchJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/products/selection-results/jobs?${query}` : "/api/products/selection-results/jobs";
  return apiFetch<ProductWorkbenchJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelMobileSelectionResultJob(jobId: string): Promise<ProductWorkbenchJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJobCancelResponse>(
    `/api/products/selection-results/jobs/${encodeURIComponent(value)}/cancel`,
    { method: "POST" },
  );
}

export async function retryMobileSelectionResultJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(
    `/api/products/selection-results/jobs/${encodeURIComponent(value)}/retry`,
    { method: "POST" },
  );
}

export async function fetchProductRouteMapping(
  productId: string,
): Promise<ProductRouteMappingDetailResponse> {
  const value = productId.trim();
  if (!value) throw new Error("productId is required.");
  return apiFetch<ProductRouteMappingDetailResponse>(
    `/api/products/${encodeURIComponent(value)}/route-mapping`,
    {
      cacheProfile: "medium",
      includeOwnerHeaders: false,
    },
  );
}

export async function fetchProductRouteMappingIndex(params?: {
  category?: string;
}): Promise<ProductRouteMappingIndexListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  const query = search.toString();
  const path = query ? `/api/products/route-mapping/index?${query}` : "/api/products/route-mapping/index";
  return apiFetch<ProductRouteMappingIndexListResponse>(path, {
    cacheProfile: "short",
    includeOwnerHeaders: false,
  });
}

export async function buildProductAnalysisStream(
  payload: ProductAnalysisBuildRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<ProductAnalysisBuildResponse> {
  return postSSE<ProductAnalysisBuildResponse>(
    "/api/products/analysis/build/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
}

export async function createProductAnalysisJob(
  payload: ProductAnalysisBuildRequest,
): Promise<ProductWorkbenchJob> {
  return apiFetch<ProductWorkbenchJob>("/api/products/analysis/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProductAnalysisJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/products/analysis/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listProductAnalysisJobs(params?: {
  status?: "queued" | "running" | "cancelling" | "cancelled" | "done" | "failed";
  offset?: number;
  limit?: number;
}): Promise<ProductWorkbenchJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/products/analysis/jobs?${query}` : "/api/products/analysis/jobs";
  return apiFetch<ProductWorkbenchJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelProductAnalysisJob(jobId: string): Promise<ProductWorkbenchJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJobCancelResponse>(
    `/api/products/analysis/jobs/${encodeURIComponent(value)}/cancel`,
    { method: "POST" },
  );
}

export async function retryProductAnalysisJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(
    `/api/products/analysis/jobs/${encodeURIComponent(value)}/retry`,
    { method: "POST" },
  );
}

export async function fetchProductAnalysis(
  productId: string,
): Promise<ProductAnalysisDetailResponse> {
  const value = productId.trim();
  if (!value) throw new Error("productId is required.");
  return apiFetch<ProductAnalysisDetailResponse>(
    `/api/products/${encodeURIComponent(value)}/analysis`,
    {
      cacheProfile: "long",
      includeOwnerHeaders: false,
    },
  );
}

export async function fetchProductAnalysisIndex(params?: {
  category?: string;
}): Promise<ProductAnalysisIndexListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  const query = search.toString();
  const path = query ? `/api/products/analysis/index?${query}` : "/api/products/analysis/index";
  return apiFetch<ProductAnalysisIndexListResponse>(path, {
    cacheProfile: "short",
    includeOwnerHeaders: false,
  });
}

export async function fetchProductFeaturedSlots(params?: {
  category?: string;
}): Promise<ProductFeaturedSlotListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  const query = search.toString();
  const path = query ? `/api/products/featured-slots?${query}` : "/api/products/featured-slots";
  return apiFetch<ProductFeaturedSlotListResponse>(path, {
    cacheProfile: "short",
    includeOwnerHeaders: false,
  });
}

export async function setProductFeaturedSlot(payload: {
  category: string;
  target_type_key: string;
  product_id: string;
  updated_by?: string;
}): Promise<ProductFeaturedSlotItem> {
  return apiFetch<ProductFeaturedSlotItem>("/api/products/featured-slots", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function clearProductFeaturedSlot(payload: {
  category: string;
  target_type_key: string;
}): Promise<{ status: string; category: string; target_type_key: string; deleted: boolean }> {
  return apiFetch<{ status: string; category: string; target_type_key: string; deleted: boolean }>(
    "/api/products/featured-slots/clear",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteProductsBatch(payload: ProductBatchDeleteRequest): Promise<ProductBatchDeleteResponse> {
  return apiFetch<ProductBatchDeleteResponse>("/api/products/batch-delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createProductBatchDeleteJob(payload: ProductBatchDeleteRequest): Promise<ProductWorkbenchJob> {
  return apiFetch<ProductWorkbenchJob>("/api/products/batch-delete/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProductBatchDeleteJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/products/batch-delete/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listProductBatchDeleteJobs(params?: {
  status?: ProductWorkbenchJob["status"];
  offset?: number;
  limit?: number;
}): Promise<ProductWorkbenchJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/products/batch-delete/jobs?${query}` : "/api/products/batch-delete/jobs";
  return apiFetch<ProductWorkbenchJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelProductBatchDeleteJob(jobId: string): Promise<ProductWorkbenchJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJobCancelResponse>(`/api/products/batch-delete/jobs/${encodeURIComponent(value)}/cancel`, {
    method: "POST",
  });
}

export async function retryProductBatchDeleteJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/products/batch-delete/jobs/${encodeURIComponent(value)}/retry`, {
    method: "POST",
  });
}

export async function cleanupOrphanStorage(payload: OrphanStorageCleanupRequest): Promise<OrphanStorageCleanupResponse> {
  return apiFetch<OrphanStorageCleanupResponse>("/api/maintenance/storage/orphans/cleanup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createOrphanStorageCleanupJob(
  payload: OrphanStorageCleanupRequest,
): Promise<ProductWorkbenchJob> {
  return apiFetch<ProductWorkbenchJob>("/api/maintenance/storage/orphans/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchOrphanStorageCleanupJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/maintenance/storage/orphans/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listOrphanStorageCleanupJobs(params?: {
  status?: ProductWorkbenchJob["status"];
  offset?: number;
  limit?: number;
}): Promise<ProductWorkbenchJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/maintenance/storage/orphans/jobs?${query}` : "/api/maintenance/storage/orphans/jobs";
  return apiFetch<ProductWorkbenchJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelOrphanStorageCleanupJob(jobId: string): Promise<ProductWorkbenchJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJobCancelResponse>(
    `/api/maintenance/storage/orphans/jobs/${encodeURIComponent(value)}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function retryOrphanStorageCleanupJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/maintenance/storage/orphans/jobs/${encodeURIComponent(value)}/retry`, {
    method: "POST",
  });
}

export async function cleanupInvalidMobileProductRefs(
  payload: MobileInvalidProductRefCleanupRequest,
): Promise<MobileInvalidProductRefCleanupResponse> {
  return apiFetch<MobileInvalidProductRefCleanupResponse>("/api/maintenance/mobile/product-refs/cleanup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createMobileInvalidProductRefCleanupJob(
  payload: MobileInvalidProductRefCleanupRequest,
): Promise<ProductWorkbenchJob> {
  return apiFetch<ProductWorkbenchJob>("/api/maintenance/mobile/product-refs/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMobileInvalidProductRefCleanupJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/maintenance/mobile/product-refs/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listMobileInvalidProductRefCleanupJobs(params?: {
  status?: ProductWorkbenchJob["status"];
  offset?: number;
  limit?: number;
}): Promise<ProductWorkbenchJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query
    ? `/api/maintenance/mobile/product-refs/jobs?${query}`
    : "/api/maintenance/mobile/product-refs/jobs";
  return apiFetch<ProductWorkbenchJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function cancelMobileInvalidProductRefCleanupJob(
  jobId: string,
): Promise<ProductWorkbenchJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJobCancelResponse>(
    `/api/maintenance/mobile/product-refs/jobs/${encodeURIComponent(value)}/cancel`,
    {
      method: "POST",
    },
  );
}

export async function retryMobileInvalidProductRefCleanupJob(jobId: string): Promise<ProductWorkbenchJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<ProductWorkbenchJob>(`/api/maintenance/mobile/product-refs/jobs/${encodeURIComponent(value)}/retry`, {
    method: "POST",
  });
}

export async function downloadAllProductImagesZip(): Promise<{
  blob: Blob;
  filename: string;
  image_count: number;
}> {
  const base = getBaseForFetch();
  const path = "/api/maintenance/storage/images/download";
  const url = base ? new URL(path, base).toString() : path;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }

  const blob = await res.blob();
  const filename = parseFilenameFromDisposition(res.headers.get("content-disposition")) || "cosmeles-product-images.zip";
  const countRaw = Number(res.headers.get("x-image-count") || "0");
  const image_count = Number.isFinite(countRaw) ? Math.max(0, Math.floor(countRaw)) : 0;
  return { blob, filename, image_count };
}

export async function createAIJob(payload: AIJobCreateRequest): Promise<AIJobView> {
  return apiFetch<AIJobView>("/api/ai/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAIJobStream(
  payload: AIJobCreateRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<AIJobView> {
  const result = await postSSE<{ job?: AIJobView }>("/api/ai/jobs/stream", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  }, onEvent);

  if (!result.job) {
    throw new Error("AI stream finished without final job result.");
  }
  return result.job;
}

export async function fetchAIRuns(params?: {
  jobId?: string;
  offset?: number;
  limit?: number;
}): Promise<AIRunView[]> {
  const search = new URLSearchParams();
  if (params?.jobId) search.set("job_id", params.jobId);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/ai/runs?${query}` : "/api/ai/runs";
  return apiFetch<AIRunView[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function fetchLatestAIRunByJobId(jobId: string): Promise<AIRunView | null> {
  const runs = await fetchAIRuns({ jobId, limit: 1, offset: 0 });
  return runs[0] || null;
}

export async function fetchAIMetricsSummary(params?: {
  capability?: string;
  sinceHours?: number;
}): Promise<AIMetricsSummary> {
  const search = new URLSearchParams();
  if (params?.capability) search.set("capability", params.capability);
  if (typeof params?.sinceHours === "number") search.set("since_hours", String(params.sinceHours));
  const query = search.toString();
  const path = query ? `/api/ai/metrics/summary?${query}` : "/api/ai/metrics/summary";
  return apiFetch<AIMetricsSummary>(path, {
    cacheProfile: "short",
    includeOwnerHeaders: false,
  });
}

function buildMobileAnalyticsQuery(params?: MobileAnalyticsQuery): string {
  const search = new URLSearchParams();
  if (typeof params?.sinceHours === "number") search.set("since_hours", String(params.sinceHours));
  if (params?.dateFrom) search.set("date_from", params.dateFrom);
  if (params?.dateTo) search.set("date_to", params.dateTo);
  if (params?.category) search.set("category", params.category);
  if (params?.page) search.set("page", params.page);
  if (params?.stage) search.set("stage", params.stage);
  if (params?.errorCode) search.set("error_code", params.errorCode);
  if (params?.triggerReason) search.set("trigger_reason", params.triggerReason);
  if (params?.sessionId) search.set("session_id", params.sessionId);
  if (params?.compareId) search.set("compare_id", params.compareId);
  if (params?.ownerId) search.set("owner_id", params.ownerId);
  if (params?.locationPresence) search.set("location_presence", params.locationPresence);
  if (params?.locationTimeZone) search.set("location_time_zone", params.locationTimeZone);
  if (params?.locationRegion) search.set("location_region", params.locationRegion);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  return search.toString();
}

export async function fetchMobileAnalyticsOverview(params?: MobileAnalyticsQuery): Promise<MobileAnalyticsOverview> {
  const query = buildMobileAnalyticsQuery(params);
  const path = query ? `/api/products/analytics/mobile/overview?${query}` : "/api/products/analytics/mobile/overview";
  return apiFetch<MobileAnalyticsOverview>(path, {
    cacheProfile: "dynamic",
  });
}

export async function fetchMobileAnalyticsFunnel(params?: MobileAnalyticsQuery): Promise<MobileAnalyticsFunnel> {
  const query = buildMobileAnalyticsQuery(params);
  const path = query ? `/api/products/analytics/mobile/funnel?${query}` : "/api/products/analytics/mobile/funnel";
  return apiFetch<MobileAnalyticsFunnel>(path, {
    cacheProfile: "dynamic",
  });
}

export async function fetchMobileAnalyticsErrors(params?: MobileAnalyticsQuery): Promise<MobileAnalyticsErrors> {
  const query = buildMobileAnalyticsQuery(params);
  const path = query ? `/api/products/analytics/mobile/errors?${query}` : "/api/products/analytics/mobile/errors";
  return apiFetch<MobileAnalyticsErrors>(path, {
    cacheProfile: "dynamic",
  });
}

export async function fetchMobileAnalyticsFeedback(params?: MobileAnalyticsQuery): Promise<MobileAnalyticsFeedback> {
  const query = buildMobileAnalyticsQuery(params);
  const path = query ? `/api/products/analytics/mobile/feedback?${query}` : "/api/products/analytics/mobile/feedback";
  return apiFetch<MobileAnalyticsFeedback>(path, {
    cacheProfile: "dynamic",
  });
}

export async function fetchMobileAnalyticsExperience(params?: MobileAnalyticsQuery): Promise<MobileAnalyticsExperience> {
  const query = buildMobileAnalyticsQuery(params);
  const path = query ? `/api/products/analytics/mobile/experience?${query}` : "/api/products/analytics/mobile/experience";
  return apiFetch<MobileAnalyticsExperience>(path, {
    cacheProfile: "dynamic",
  });
}

export async function fetchMobileAnalyticsSessions(params?: MobileAnalyticsQuery): Promise<MobileAnalyticsSessions> {
  const query = buildMobileAnalyticsQuery(params);
  const path = query ? `/api/products/analytics/mobile/sessions?${query}` : "/api/products/analytics/mobile/sessions";
  return apiFetch<MobileAnalyticsSessions>(path, {
    cacheProfile: "dynamic",
  });
}

export async function resolveMobileSelection(
  payload: MobileSelectionResolveRequest,
): Promise<MobileSelectionResolveResponse> {
  return apiFetch<MobileSelectionResolveResponse>("/api/mobile/selection/resolve", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMobileSelectionSession(sessionId: string): Promise<MobileSelectionResolveResponse> {
  return apiFetch<MobileSelectionResolveResponse>(`/api/mobile/selection/sessions/${encodeURIComponent(sessionId)}`, {
    cacheProfile: "dynamic",
  });
}

export async function fetchMobileSelectionFitExplanation(
  sessionId: string,
): Promise<MobileSelectionFitExplanationResponse> {
  const value = sessionId.trim();
  if (!value) throw new Error("sessionId is required.");
  return apiFetch<MobileSelectionFitExplanationResponse>(
    `/api/mobile/selection/sessions/${encodeURIComponent(value)}/fit-explanation`,
    {
      cacheProfile: "dynamic",
    },
  );
}

export async function fetchMobileSelectionResult(payload: {
  category: MobileSelectionCategory;
  answers: Record<string, string>;
}): Promise<MobileSelectionResultResponse> {
  return apiFetch<MobileSelectionResultResponse>("/api/mobile/selection/result", {
    method: "POST",
    body: JSON.stringify(payload),
    cacheProfile: "dynamic",
    // Result pages run as Next server components; owner cookie/device id must be
    // forwarded so the newly created selection session lands under the same device.
    includeOwnerHeaders: true,
  });
}

export async function listMobileSelectionSessions(params?: {
  category?: MobileSelectionCategory;
  offset?: number;
  limit?: number;
}): Promise<MobileSelectionResolveResponse[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/selection/sessions?${query}` : "/api/mobile/selection/sessions";
  return apiFetch<MobileSelectionResolveResponse[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function deleteMobileSelectionSessionsBatch(
  payload: MobileSelectionBatchDeleteRequest,
): Promise<MobileSelectionBatchDeleteResponse> {
  return apiFetch<MobileSelectionBatchDeleteResponse>("/api/mobile/selection/sessions/batch/delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function pinMobileSelectionSession(
  sessionId: string,
  payload: MobileSelectionPinRequest,
): Promise<MobileSelectionResolveResponse> {
  return apiFetch<MobileSelectionResolveResponse>(
    `/api/mobile/selection/sessions/${encodeURIComponent(sessionId)}/pin`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchMobileWikiProducts(params?: {
  category?: MobileSelectionCategory;
  target_type_key?: string;
  q?: string;
  offset?: number;
  limit?: number;
}): Promise<MobileWikiProductListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.target_type_key) search.set("target_type_key", params.target_type_key);
  if (params?.q) search.set("q", params.q);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/wiki/products?${query}` : "/api/mobile/wiki/products";
  return apiFetch<MobileWikiProductListResponse>(path, {
    cacheProfile: "short",
    includeOwnerHeaders: false,
  });
}

export async function fetchMobileWikiProductDetail(productId: string): Promise<MobileWikiProductDetailResponse> {
  const value = productId.trim();
  if (!value) throw new Error("productId is required.");
  return apiFetch<MobileWikiProductDetailResponse>(`/api/mobile/wiki/products/${encodeURIComponent(value)}`, {
    cacheProfile: "medium",
    includeOwnerHeaders: false,
  });
}

export async function fetchMobileWikiProductAnalysis(productId: string): Promise<MobileWikiProductAnalysisResponse> {
  const value = productId.trim();
  if (!value) throw new Error("productId is required.");
  return apiFetch<MobileWikiProductAnalysisResponse>(
    `/api/mobile/wiki/products/${encodeURIComponent(value)}/analysis`,
    {
      cacheProfile: "long",
      includeOwnerHeaders: false,
    },
  );
}

export async function fetchMobileBagItems(params?: {
  category?: MobileSelectionCategory;
  offset?: number;
  limit?: number;
}): Promise<MobileBagListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/bag/items?${query}` : "/api/mobile/bag/items";
  return apiFetch<MobileBagListResponse>(path, {
    cacheProfile: "dynamic",
  });
}

export async function upsertMobileBagItem(payload: {
  product_id: string;
  quantity?: number;
}): Promise<MobileBagItem> {
  return apiFetch<MobileBagItem>("/api/mobile/bag/items", {
    method: "POST",
    body: JSON.stringify({
      product_id: payload.product_id,
      quantity: payload.quantity ?? 1,
    }),
  });
}

export async function deleteMobileBagItem(itemId: string): Promise<{ status: string; item_id: string; deleted: boolean }> {
  const value = itemId.trim();
  if (!value) throw new Error("itemId is required.");
  return apiFetch<{ status: string; item_id: string; deleted: boolean }>(
    `/api/mobile/bag/items/${encodeURIComponent(value)}`,
    { method: "DELETE" },
  );
}

export async function fetchMobileCompareBootstrap(category?: MobileSelectionCategory): Promise<MobileCompareBootstrapResponse> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<MobileCompareBootstrapResponse>(`/api/mobile/compare/bootstrap${query}`, {
    cacheProfile: "dynamic",
  });
}

export async function fetchMobileUserProducts(params?: {
  category?: MobileSelectionCategory;
  offset?: number;
  limit?: number;
}): Promise<MobileUserProductListResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/user-products?${query}` : "/api/mobile/user-products";
  return apiFetch<MobileUserProductListResponse>(path, {
    cacheProfile: "dynamic",
  });
}

export async function uploadMobileCompareCurrentProduct(input: {
  category: MobileSelectionCategory;
  image: File;
  brand?: string;
  name?: string;
}): Promise<MobileCompareUploadResponse> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/mobile/compare/current-product/upload", base).toString() : "/api/mobile/compare/current-product/upload";
  const fd = new FormData();
  fd.append("category", input.category);
  fd.append("image", input.image);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);

  const res = await fetch(url, {
    method: "POST",
    body: fd,
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`COMPARE_UPLOAD ${res.status}: ${text}`);
  }
  return (await res.json()) as MobileCompareUploadResponse;
}

export async function runMobileCompareJobStream(
  payload: MobileCompareJobRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<MobileCompareResult> {
  return postSSE<MobileCompareResult>(
    "/api/mobile/compare/jobs/stream",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    },
    onEvent,
  );
}

export async function fetchMobileCompareResult(compareId: string): Promise<MobileCompareResult> {
  return apiFetch<MobileCompareResult>(`/api/mobile/compare/results/${encodeURIComponent(compareId)}`, {
    cacheProfile: "dynamic",
  });
}

export async function fetchMobileCompareSession(compareId: string): Promise<MobileCompareSession> {
  return apiFetch<MobileCompareSession>(`/api/mobile/compare/sessions/${encodeURIComponent(compareId)}`, {
    cacheProfile: "dynamic",
  });
}

export async function listMobileCompareSessions(params?: {
  category?: MobileSelectionCategory;
  offset?: number;
  limit?: number;
}): Promise<MobileCompareSession[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/mobile/compare/sessions?${query}` : "/api/mobile/compare/sessions";
  return apiFetch<MobileCompareSession[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function deleteMobileCompareSessionsBatch(
  payload: MobileCompareBatchDeleteRequest,
): Promise<MobileCompareBatchDeleteResponse> {
  return apiFetch<MobileCompareBatchDeleteResponse>("/api/mobile/compare/sessions/batch/delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function recordMobileEvent(name: string, props: Record<string, unknown> = {}): Promise<{ status: string; trace_id: string }> {
  return apiFetch<{ status: string; trace_id: string }>("/api/mobile/events", {
    method: "POST",
    body: JSON.stringify({ name, props }),
  });
}

export async function recordMobileCompareEvent(name: string, props: Record<string, unknown> = {}): Promise<{ status: string; trace_id: string }> {
  return recordMobileEvent(name, props);
}

function normalizePublicImagePath(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

// 图片 URL：统一返回浏览器可访问地址（优先同域相对路径）
export function resolveImageUrl(product: Product): string {
  const p = product.image_url || `/images/${product.id}.png`;
  return normalizePublicImagePath(p);
}

export function resolveStoredImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  return normalizePublicImagePath(imagePath);
}

export type IngestInput = {
  image?: File;
  category?: string;
  brand?: string;
  name?: string;
  source?: "manual" | "doubao" | "auto";
  metaJson?: string;
  stage1ModelTier?: "mini" | "lite" | "pro";
  stage2ModelTier?: "mini" | "lite" | "pro";
};

export type IngestResult = {
  id: string;
  status: string;
  mode?: string;
  category?: string;
  image_path?: string | null;
  json_path?: string | null;
  doubao?: {
    pipeline_mode?: string | null;
    models?: { vision?: string; struct?: string } | null;
    vision_text?: string | null;
    struct_text?: string | null;
    artifacts?: { vision?: string | null; struct?: string | null; context?: string | null } | null;
  } | null;
};

export type IngestStage1Result = {
  status: "ok" | "needs_more_images" | string;
  trace_id: string;
  category?: string;
  image_path?: string | null;
  image_paths?: string[];
  needs_more_images?: boolean;
  missing_fields?: string[];
  required_view?: string | null;
  doubao?: {
    pipeline_mode?: string | null;
    models?: { vision?: string; struct?: string } | null;
    vision_text?: string | null;
    artifacts?: { vision?: string | null; context?: string | null } | null;
  } | null;
  next?: string;
};

export type UploadIngestJobError = {
  code: string;
  detail: string;
  http_status: number;
};

export type UploadIngestJob = {
  status: "queued" | "running" | "waiting_more" | "cancelling" | "cancelled" | "done" | "failed";
  job_id: string;
  file_name?: string | null;
  source_content_type?: string | null;
  stage?: string | null;
  stage_label?: string | null;
  message?: string | null;
  percent: number;
  image_path?: string | null;
  image_paths: string[];
  has_primary_temp_preview: boolean;
  has_supplement_temp_preview: boolean;
  temp_preview_url?: string | null;
  supplement_temp_preview_url?: string | null;
  can_retry: boolean;
  can_resume: boolean;
  artifact_context_lost: boolean;
  artifact_context_detail?: string | null;
  category_override?: string | null;
  brand_override?: string | null;
  name_override?: string | null;
  stage1_model_tier?: "mini" | "lite" | "pro" | null;
  stage2_model_tier?: "mini" | "lite" | "pro" | null;
  stage1_text?: string | null;
  stage1_reasoning_text?: string | null;
  stage2_text?: string | null;
  stage2_reasoning_text?: string | null;
  missing_fields: string[];
  required_view?: string | null;
  models?: Record<string, unknown> | null;
  artifacts?: Record<string, unknown> | null;
  result?: IngestResult | Record<string, unknown> | null;
  error?: UploadIngestJobError | null;
  cancel_requested: boolean;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export type UploadIngestJobCancelResponse = {
  status: string;
  job: UploadIngestJob;
};

// 上传入口（MVP）：支持 image + metaJson，后续直接对接豆包比对流
export async function ingestProduct(input: IngestInput): Promise<IngestResult> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload", base).toString() : "/api/upload";

  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.source) fd.append("source", input.source);
  if (input.metaJson) fd.append("meta_json", input.metaJson);
  if (input.stage1ModelTier) fd.append("stage1_model_tier", input.stage1ModelTier);
  if (input.stage2ModelTier) fd.append("stage2_model_tier", input.stage2ModelTier);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`INGEST ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestResult;
}

export async function ingestProductStage1(
  input: Pick<IngestInput, "image" | "category" | "brand" | "name"> & { modelTier?: "mini" | "lite" | "pro" },
): Promise<IngestStage1Result> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/stage1", base).toString() : "/api/upload/stage1";
  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.modelTier) fd.append("model_tier", input.modelTier);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STAGE1 ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestStage1Result;
}

export async function ingestProductStage1Stream(
  input: Pick<IngestInput, "image" | "category" | "brand" | "name"> & { modelTier?: "mini" | "lite" | "pro" },
  onEvent: (event: SSEEvent) => void,
): Promise<IngestStage1Result> {
  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.modelTier) fd.append("model_tier", input.modelTier);
  return postSSE<IngestStage1Result>("/api/upload/stage1/stream", { method: "POST", body: fd }, onEvent);
}

export async function ingestProductStage1Supplement(
  input: { traceId: string; image: File; modelTier?: "mini" | "lite" | "pro" },
): Promise<IngestStage1Result> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/stage1/supplement", base).toString() : "/api/upload/stage1/supplement";
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  fd.append("image", input.image);
  if (input.modelTier) fd.append("model_tier", input.modelTier);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STAGE1_SUPPLEMENT ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestStage1Result;
}

export async function ingestProductStage1SupplementStream(
  input: { traceId: string; image: File; modelTier?: "mini" | "lite" | "pro" },
  onEvent: (event: SSEEvent) => void,
): Promise<IngestStage1Result> {
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  fd.append("image", input.image);
  if (input.modelTier) fd.append("model_tier", input.modelTier);
  return postSSE<IngestStage1Result>("/api/upload/stage1/supplement/stream", { method: "POST", body: fd }, onEvent);
}

export async function ingestProductStage2(
  input: Pick<IngestInput, "category" | "brand" | "name"> & { traceId: string; modelTier?: "mini" | "lite" | "pro" },
): Promise<IngestResult> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/stage2", base).toString() : "/api/upload/stage2";
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.modelTier) fd.append("model_tier", input.modelTier);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`STAGE2 ${res.status}: ${text}`);
  }
  return (await res.json()) as IngestResult;
}

export async function ingestProductStage2Stream(
  input: Pick<IngestInput, "category" | "brand" | "name"> & { traceId: string; modelTier?: "mini" | "lite" | "pro" },
  onEvent: (event: SSEEvent) => void,
): Promise<IngestResult> {
  const fd = new FormData();
  fd.append("trace_id", input.traceId);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.modelTier) fd.append("model_tier", input.modelTier);
  return postSSE<IngestResult>("/api/upload/stage2/stream", { method: "POST", body: fd }, onEvent);
}

export async function createUploadIngestJob(input: {
  image: File;
  supplementImage?: File;
  category?: string;
  brand?: string;
  name?: string;
  stage1ModelTier?: "mini" | "lite" | "pro";
  stage2ModelTier?: "mini" | "lite" | "pro";
}): Promise<UploadIngestJob> {
  const base = getBaseForFetch();
  const url = base ? new URL("/api/upload/jobs", base).toString() : "/api/upload/jobs";
  const fd = new FormData();
  fd.append("image", input.image);
  if (input.supplementImage) fd.append("supplement_image", input.supplementImage);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  if (input.stage1ModelTier) fd.append("stage1_model_tier", input.stage1ModelTier);
  if (input.stage2ModelTier) fd.append("stage2_model_tier", input.stage2ModelTier);
  const res = await fetch(url, { method: "POST", body: fd, credentials: "include", cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`UPLOAD_JOB_CREATE ${res.status}: ${text}`);
  }
  return (await res.json()) as UploadIngestJob;
}

export async function listUploadIngestJobs(params?: {
  status?: UploadIngestJob["status"];
  offset?: number;
  limit?: number;
}): Promise<UploadIngestJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/api/upload/jobs?${query}` : "/api/upload/jobs";
  return apiFetch<UploadIngestJob[]>(path, {
    cacheProfile: "dynamic",
  });
}

export async function fetchUploadIngestJob(jobId: string): Promise<UploadIngestJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<UploadIngestJob>(`/api/upload/jobs/${encodeURIComponent(value)}`, {
    cacheProfile: "dynamic",
  });
}

export async function cancelUploadIngestJob(jobId: string): Promise<UploadIngestJobCancelResponse> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<UploadIngestJobCancelResponse>(`/api/upload/jobs/${encodeURIComponent(value)}/cancel`, { method: "POST" });
}

export async function retryUploadIngestJob(jobId: string): Promise<UploadIngestJob> {
  const value = jobId.trim();
  if (!value) throw new Error("jobId is required.");
  return apiFetch<UploadIngestJob>(`/api/upload/jobs/${encodeURIComponent(value)}/retry`, { method: "POST" });
}

export async function resumeUploadIngestJob(input: {
  jobId: string;
  image?: File | null;
  category?: string;
  brand?: string;
  name?: string;
}): Promise<UploadIngestJob> {
  const value = input.jobId.trim();
  if (!value) throw new Error("jobId is required.");
  const base = getBaseForFetch();
  const url = base ? new URL(`/api/upload/jobs/${encodeURIComponent(value)}/resume`, base).toString() : `/api/upload/jobs/${encodeURIComponent(value)}/resume`;
  const fd = new FormData();
  if (input.image) fd.append("image", input.image);
  if (input.category) fd.append("category", input.category);
  if (input.brand) fd.append("brand", input.brand);
  if (input.name) fd.append("name", input.name);
  const res = await fetch(url, { method: "POST", body: fd, credentials: "include", cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`UPLOAD_JOB_RESUME ${res.status}: ${text}`);
  }
  return (await res.json()) as UploadIngestJob;
}

// 兼容旧调用
export async function ingestImage(file: File): Promise<{ id: string }> {
  const result = await ingestProduct({ image: file, source: "auto" });
  return { id: result.id };
}

async function postSSE<T>(
  path: string,
  init: RequestInit,
  onEvent: (event: SSEEvent) => void,
): Promise<T> {
  const base = getBaseForFetch();
  const forwarded = await getForwardedServerHeaders();
  const url = base ? new URL(path, base).toString() : path;
  const headers = new Headers({
    ...forwarded,
    accept: "text/event-stream",
  });
  const initHeaders = new Headers(init.headers || {});
  initHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} ${res.status}: ${text}`);
  }

  if (!res.body) {
    throw new Error(`${path}: stream body is empty`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: T | null = null;
  let finalError: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    while (true) {
      const idx = buffer.indexOf("\n\n");
      if (idx < 0) break;
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!raw || raw.startsWith(":")) continue;

      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      const dataRaw = dataLines.join("\n");
      let data: Record<string, unknown> = {};
      try {
        data = dataRaw ? (JSON.parse(dataRaw) as Record<string, unknown>) : {};
      } catch {
        data = { raw: dataRaw };
      }

      onEvent({ event, data });
      if (event === "result") {
        finalResult = data as T;
      } else if (event === "error") {
        const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data);
        finalError = detail;
      }
    }
  }

  if (finalError) {
    throw new Error(finalError);
  }
  if (finalResult == null) {
    throw new Error(`${path}: stream ended without result`);
  }
  return finalResult;
}
