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

export type DecisionContinuationAction = "resume_profile" | "reopen_result" | "go_choose";

export type DecisionContinuationTarget = {
  action: DecisionContinuationAction;
  category: MobileSelectionCategory | null;
  href: string;
  titleZh: string;
  descriptionZh: string;
};

type StorageLike = Pick<Storage, "getItem">;
type MutableStorageLike = Pick<Storage, "getItem"> & Partial<Pick<Storage, "removeItem">>;

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

type ReadDecisionResumeOptions = {
  preferredCategory?: MobileSelectionCategory | string | null;
};

type ReadDecisionContinuationOptions = ReadDecisionResumeOptions & {
  source?: string | null;
};

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

export function readDecisionResumeItem(
  storage: MutableStorageLike,
  options?: ReadDecisionResumeOptions,
): DecisionResumeItem | null {
  const preferredCategory = resolvePreferredCategory(storage, options?.preferredCategory);
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

export function readDecisionContinuationTarget(
  storage: MutableStorageLike,
  options?: ReadDecisionContinuationOptions,
): DecisionContinuationTarget {
  const source = String(options?.source || "").trim();
  const preferredCategory = resolvePreferredCategory(storage, options?.preferredCategory);
  const resumeItem = readDecisionResumeItem(storage, { preferredCategory });
  if (resumeItem) {
    const action = resumeItem.kind === "draft" ? "resume_profile" : "reopen_result";
    return {
      action,
      category: resumeItem.category,
      href: appendSourceToPath(resumeItem.targetPath, source),
      titleZh:
        action === "resume_profile"
          ? `继续 ${resumeItem.labelZh} 问答`
          : `回到 ${resumeItem.labelZh} 最近结果`,
      descriptionZh:
        action === "resume_profile"
          ? `已完成 ${resumeItem.answeredCount}/${resumeItem.totalSteps} 步，继续即可。`
          : "可直接打开最近一次结果，继续下一步操作。",
    };
  }

  const choosePath = preferredCategory ? `/m/choose?category=${preferredCategory}` : "/m/choose";
  return {
    action: "go_choose",
    category: preferredCategory,
    href: appendSourceToPath(choosePath, source),
    titleZh: "回到个性挑选",
    descriptionZh: "未检测到可恢复记录，从挑选入口重新开始。",
  };
}

export function readDecisionDraftSignals(
  storage: MutableStorageLike,
  category: MobileSelectionCategory,
): Record<string, string> | null {
  const meta = STORAGE_META[category];
  const draft = readDraftResumeState(storage, meta);
  return draft ? { ...draft.answers } : null;
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

function resolvePreferredCategory(
  storage: StorageLike,
  preferredCategory: MobileSelectionCategory | string | null | undefined,
): MobileSelectionCategory | null {
  return (
    normalizeDecisionCategory(preferredCategory) ||
    normalizeDecisionCategory(storage.getItem(DECISION_SELECTED_CATEGORY_STORAGE_KEY))
  );
}

function listDecisionResumeCandidates(
  storage: MutableStorageLike,
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
  storage: MutableStorageLike,
  meta: DecisionStorageMeta,
): DecisionResumeItem | null {
  const draft = readDraftResumeState(storage, meta);
  if (!draft) return null;
  const params = new URLSearchParams();
  for (let index = 0; index < draft.answeredCount; index += 1) {
    const key = meta.stepKeys[index];
    params.set(key, String(draft.answers[key] || ""));
  }
  params.set("step", String(draft.answeredCount + 1));
  return {
    kind: "draft",
    category: meta.catalog.key,
    labelZh: meta.catalog.labelZh,
    answeredCount: draft.answeredCount,
    totalSteps: meta.catalog.questionCount,
    targetPath: `/m/${meta.catalog.key}/profile?${params.toString()}`,
  };
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

type DraftResumeState = {
  answeredCount: number;
  answers: Record<string, string>;
};

function readDraftResumeState(
  storage: MutableStorageLike,
  meta: DecisionStorageMeta,
): DraftResumeState | null {
  const raw = storage.getItem(meta.draftKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") {
      storage.removeItem?.(meta.draftKey);
      return null;
    }
    const answeredCount = countSequentialAnswers(meta.stepKeys, parsed);
    if (answeredCount <= 0) {
      storage.removeItem?.(meta.draftKey);
      return null;
    }
    if (answeredCount >= meta.stepKeys.length) {
      storage.removeItem?.(meta.draftKey);
      return null;
    }

    const answers: Record<string, string> = {};
    for (let index = 0; index < answeredCount; index += 1) {
      const key = meta.stepKeys[index];
      const value = String(parsed[key] || "").trim();
      if (!value) break;
      answers[key] = value;
    }

    const resultAnswers = readResultAnswers(meta, storage);
    if (resultAnswers && isDraftCoveredByResult(meta.stepKeys, answers, resultAnswers)) {
      storage.removeItem?.(meta.draftKey);
      return null;
    }

    return {
      answeredCount,
      answers,
    };
  } catch {
    storage.removeItem?.(meta.draftKey);
    return null;
  }
}

function readResultAnswers(
  meta: DecisionStorageMeta,
  storage: StorageLike,
): Record<string, string> | null {
  const normalizedQuery = meta.normalizeResultQuery(storage.getItem(meta.lastResultKey));
  if (!normalizedQuery) return null;
  const params = new URLSearchParams(normalizedQuery);
  const answers: Record<string, string> = {};
  for (const key of meta.stepKeys) {
    const value = String(params.get(key) || "").trim();
    if (!value) return null;
    answers[key] = value;
  }
  return answers;
}

function isDraftCoveredByResult(
  stepKeys: readonly string[],
  draftAnswers: Record<string, string>,
  resultAnswers: Record<string, string>,
): boolean {
  const answeredKeys = stepKeys.filter((key) => Boolean(String(draftAnswers[key] || "").trim()));
  if (answeredKeys.length === 0 || answeredKeys.length >= stepKeys.length) return false;
  return answeredKeys.every((key) => draftAnswers[key] === resultAnswers[key]);
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
