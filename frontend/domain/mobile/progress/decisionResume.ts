import type { MobileSelectionCategory } from "@/lib/api";
import {
  listDecisionCategories,
  type DecisionCategoryCatalogItem,
} from "@/domain/mobile/decision/catalog";
import { listBodyWashProfileSteps } from "@/domain/mobile/decision/bodywash";
import { listCleanserProfileSteps } from "@/domain/mobile/decision/cleanser";
import { listConditionerProfileSteps } from "@/domain/mobile/decision/conditioner";
import { listLotionProfileSteps } from "@/domain/mobile/decision/lotion";
import { listShampooProfileSteps } from "@/domain/mobile/decision/shampoo";
import {
  BODYWASH_LAST_RESULT_QUERY_KEY,
  BODYWASH_PROFILE_DRAFT_KEY,
  normalizeBodyWashResultQueryString,
} from "@/lib/mobile/bodywashFlowStorage";
import {
  CLEANSER_LAST_RESULT_QUERY_KEY,
  CLEANSER_PROFILE_DRAFT_KEY,
  normalizeCleanserResultQueryString,
} from "@/lib/mobile/cleanserFlowStorage";
import {
  CONDITIONER_LAST_RESULT_QUERY_KEY,
  CONDITIONER_PROFILE_DRAFT_KEY,
  normalizeConditionerResultQueryString,
} from "@/lib/mobile/conditionerFlowStorage";
import {
  LOTION_LAST_RESULT_QUERY_KEY,
  LOTION_PROFILE_DRAFT_KEY,
  normalizeLotionResultQueryString,
} from "@/lib/mobile/lotionFlowStorage";
import {
  SHAMPOO_LAST_RESULT_QUERY_KEY,
  SHAMPOO_PROFILE_DRAFT_KEY,
  normalizeShampooResultQueryString,
} from "@/lib/mobile/shampooFlowStorage";

export const DECISION_SELECTED_CATEGORY_STORAGE_KEY = "mx_mobile_choose_selected_category_v1";

export type DecisionResumeItem = {
  kind: "draft" | "result";
  category: MobileSelectionCategory;
  labelZh: string;
  answeredCount: number;
  totalSteps: number;
  targetPath: string;
};

type StorageLike = Pick<Storage, "getItem">;

type DecisionStorageMeta = {
  catalog: DecisionCategoryCatalogItem;
  stepKeys: readonly string[];
  draftKey: string;
  lastResultKey: string;
  normalizeResultQuery: (raw: string | null | undefined) => string | null;
};

const STEP_KEYS: Record<MobileSelectionCategory, readonly string[]> = {
  shampoo: listShampooProfileSteps().map((step) => step.key),
  bodywash: listBodyWashProfileSteps().map((step) => step.key),
  conditioner: listConditionerProfileSteps().map((step) => step.key),
  lotion: listLotionProfileSteps().map((step) => step.key),
  cleanser: listCleanserProfileSteps().map((step) => step.key),
};

const STORAGE_META: Record<MobileSelectionCategory, DecisionStorageMeta> = listDecisionCategories().reduce(
  (acc, catalog) => {
    acc[catalog.key] = {
      catalog,
      stepKeys: STEP_KEYS[catalog.key],
      draftKey: getDraftKey(catalog.key),
      lastResultKey: getLastResultKey(catalog.key),
      normalizeResultQuery: getResultNormalizer(catalog.key),
    };
    return acc;
  },
  {} as Record<MobileSelectionCategory, DecisionStorageMeta>,
);

export function normalizeDecisionCategory(
  raw: string | null | undefined,
): MobileSelectionCategory | null {
  const normalized = String(raw || "").trim().toLowerCase();
  if (
    normalized === "shampoo" ||
    normalized === "bodywash" ||
    normalized === "conditioner" ||
    normalized === "lotion" ||
    normalized === "cleanser"
  ) {
    return normalized;
  }
  return null;
}

export function readDecisionResumeItem(storage: StorageLike): DecisionResumeItem | null {
  const preferredCategory = normalizeDecisionCategory(storage.getItem(DECISION_SELECTED_CATEGORY_STORAGE_KEY));
  const drafts = listDecisionResumeCandidates(storage, "draft");
  if (preferredCategory) {
    const preferredDraft = drafts.find((item) => item.category === preferredCategory);
    if (preferredDraft) return preferredDraft;
  }
  if (drafts.length > 0) return drafts[0];

  const results = listDecisionResumeCandidates(storage, "result");
  if (preferredCategory) {
    const preferredResult = results.find((item) => item.category === preferredCategory);
    if (preferredResult) return preferredResult;
  }
  return results[0] || null;
}

export function appendSourceToPath(path: string, source: string): string {
  const cleanSource = String(source || "").trim();
  if (!cleanSource) return path;
  const [pathname, hash = ""] = path.split("#", 2);
  const [basePath, query = ""] = pathname.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("source", cleanSource);
  const nextQuery = params.toString();
  return `${basePath}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}

function listDecisionResumeCandidates(
  storage: StorageLike,
  kind: DecisionResumeItem["kind"],
): DecisionResumeItem[] {
  return listDecisionCategories()
    .map((catalog) => {
      const meta = STORAGE_META[catalog.key];
      return kind === "draft" ? readDraftResumeCandidate(storage, meta) : readResultResumeCandidate(storage, meta);
    })
    .filter((item): item is DecisionResumeItem => Boolean(item));
}

function readDraftResumeCandidate(
  storage: StorageLike,
  meta: DecisionStorageMeta,
): DecisionResumeItem | null {
  const raw = storage.getItem(meta.draftKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const answeredCount = countSequentialAnswers(meta.stepKeys, parsed);
    if (answeredCount <= 0 || answeredCount >= meta.stepKeys.length) return null;
    const params = new URLSearchParams();
    for (let index = 0; index < answeredCount; index += 1) {
      const key = meta.stepKeys[index];
      params.set(key, String(parsed[key] || ""));
    }
    params.set("step", String(answeredCount + 1));
    return {
      kind: "draft",
      category: meta.catalog.key,
      labelZh: meta.catalog.labelZh,
      answeredCount,
      totalSteps: meta.catalog.questionCount,
      targetPath: `/m/${meta.catalog.key}/profile?${params.toString()}`,
    };
  } catch {
    return null;
  }
}

function readResultResumeCandidate(
  storage: StorageLike,
  meta: DecisionStorageMeta,
): DecisionResumeItem | null {
  const normalizedQuery = meta.normalizeResultQuery(storage.getItem(meta.lastResultKey));
  if (!normalizedQuery) return null;
  return {
    kind: "result",
    category: meta.catalog.key,
    labelZh: meta.catalog.labelZh,
    answeredCount: meta.catalog.questionCount,
    totalSteps: meta.catalog.questionCount,
    targetPath: `/m/${meta.catalog.key}/result?${normalizedQuery}`,
  };
}

function countSequentialAnswers(stepKeys: readonly string[], draft: Record<string, unknown>): number {
  let answeredCount = 0;
  for (const key of stepKeys) {
    const value = String(draft[key] || "").trim();
    if (!value) break;
    answeredCount += 1;
  }
  return answeredCount;
}

function getDraftKey(category: MobileSelectionCategory): string {
  if (category === "shampoo") return SHAMPOO_PROFILE_DRAFT_KEY;
  if (category === "bodywash") return BODYWASH_PROFILE_DRAFT_KEY;
  if (category === "conditioner") return CONDITIONER_PROFILE_DRAFT_KEY;
  if (category === "lotion") return LOTION_PROFILE_DRAFT_KEY;
  return CLEANSER_PROFILE_DRAFT_KEY;
}

function getLastResultKey(category: MobileSelectionCategory): string {
  if (category === "shampoo") return SHAMPOO_LAST_RESULT_QUERY_KEY;
  if (category === "bodywash") return BODYWASH_LAST_RESULT_QUERY_KEY;
  if (category === "conditioner") return CONDITIONER_LAST_RESULT_QUERY_KEY;
  if (category === "lotion") return LOTION_LAST_RESULT_QUERY_KEY;
  return CLEANSER_LAST_RESULT_QUERY_KEY;
}

function getResultNormalizer(
  category: MobileSelectionCategory,
): (raw: string | null | undefined) => string | null {
  if (category === "shampoo") return normalizeShampooResultQueryString;
  if (category === "bodywash") return normalizeBodyWashResultQueryString;
  if (category === "conditioner") return normalizeConditionerResultQueryString;
  if (category === "lotion") return normalizeLotionResultQueryString;
  return normalizeCleanserResultQueryString;
}
