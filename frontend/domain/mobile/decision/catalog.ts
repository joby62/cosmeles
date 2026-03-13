import type { MobileSelectionCategory } from "@/lib/api";
import type { Lang } from "@/lib/i18n";
import rawCatalog from "@/generated/mobile/decision/categories";

type RawDecisionCategoryCatalog = {
  schema_version: string;
  primary_entry: string;
  capabilities: readonly string[];
  categories: readonly {
    key: string;
    label_zh: string;
    label_en: string;
    question_count: number;
    estimated_seconds: number;
  }[];
};

export type DecisionCategoryCatalogItem = {
  key: MobileSelectionCategory;
  labelZh: string;
  labelEn: string;
  questionCount: number;
  estimatedSeconds: number;
};

const CATEGORY_KEYS: MobileSelectionCategory[] = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"];
const CATEGORY_SET = new Set<MobileSelectionCategory>(CATEGORY_KEYS);
const catalog = parseDecisionCatalog(rawCatalog as RawDecisionCategoryCatalog);
const CATEGORY_MAP = new Map<MobileSelectionCategory, DecisionCategoryCatalogItem>(
  catalog.categories.map((item) => [item.key, item] as const),
);

export function getDecisionCatalogPrimaryEntry(): string {
  return catalog.primaryEntry;
}

export function listDecisionCategories(): readonly DecisionCategoryCatalogItem[] {
  return catalog.categories;
}

export function getDecisionCategoryCatalogItem(
  category: MobileSelectionCategory | string | null | undefined,
): DecisionCategoryCatalogItem | null {
  const normalized = normalizeCategory(category);
  if (!normalized) return null;
  return CATEGORY_MAP.get(normalized) || null;
}

export function getDecisionCategoryLabel(
  category: MobileSelectionCategory | string | null | undefined,
  lang: Lang = "zh",
): string | null {
  const item = getDecisionCategoryCatalogItem(category);
  if (!item) return null;
  return lang === "en" ? item.labelEn : item.labelZh;
}

export function formatDecisionDurationSummary(item: DecisionCategoryCatalogItem, lang: Lang = "zh"): string {
  if (lang === "en") {
    return `${item.questionCount} steps · ~${item.estimatedSeconds}s`;
  }
  return `${item.questionCount} 步 · 约 ${item.estimatedSeconds} 秒`;
}

function parseDecisionCatalog(raw: RawDecisionCategoryCatalog): {
  schemaVersion: string;
  primaryEntry: string;
  capabilities: readonly string[];
  categories: readonly DecisionCategoryCatalogItem[];
} {
  const schemaVersion = String(raw.schema_version || "").trim();
  const primaryEntry = String(raw.primary_entry || "").trim();
  const capabilities = Array.isArray(raw.capabilities)
    ? raw.capabilities.map((item) => String(item || "").trim()).filter((item) => item.length > 0)
    : [];
  if (!schemaVersion) {
    throw new Error("shared/mobile/decision/categories.json missing schema_version");
  }
  if (!primaryEntry) {
    throw new Error("shared/mobile/decision/categories.json missing primary_entry");
  }
  const categories = Array.isArray(raw.categories) ? raw.categories.map(parseDecisionCategory) : [];
  if (categories.length === 0) {
    throw new Error("shared/mobile/decision/categories.json must contain categories");
  }
  return {
    schemaVersion,
    primaryEntry,
    capabilities,
    categories,
  };
}

function parseDecisionCategory(raw: RawDecisionCategoryCatalog["categories"][number]): DecisionCategoryCatalogItem {
  const key = normalizeCategory(raw.key);
  if (!key) {
    throw new Error(`Unsupported decision category key: ${String(raw.key || "")}`);
  }
  const labelZh = String(raw.label_zh || "").trim();
  const labelEn = String(raw.label_en || "").trim();
  const questionCount = Number(raw.question_count);
  const estimatedSeconds = Number(raw.estimated_seconds);
  if (!labelZh || !labelEn) {
    throw new Error(`Decision category ${key} is missing localized labels`);
  }
  if (!Number.isFinite(questionCount) || questionCount <= 0) {
    throw new Error(`Decision category ${key} has invalid question_count`);
  }
  if (!Number.isFinite(estimatedSeconds) || estimatedSeconds <= 0) {
    throw new Error(`Decision category ${key} has invalid estimated_seconds`);
  }
  return {
    key,
    labelZh,
    labelEn,
    questionCount,
    estimatedSeconds,
  };
}

function normalizeCategory(raw: MobileSelectionCategory | string | null | undefined): MobileSelectionCategory | null {
  const normalized = String(raw || "").trim().toLowerCase();
  return CATEGORY_SET.has(normalized as MobileSelectionCategory) ? (normalized as MobileSelectionCategory) : null;
}
