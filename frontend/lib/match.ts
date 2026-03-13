import type { SiteLocale } from "@/lib/sitePreferences";
import { getCategoryMeta } from "@/lib/site";
import * as en from "@/lib/match.en";
import * as zh from "@/lib/match.zh";
import type {
  MatchAnswers,
  MatchCategoryConfig,
  MatchQuestion,
  MatchQuestionOption,
  MatchRouteMeta,
} from "@/lib/match.en";
import type { CategoryKey } from "@/lib/site.en";

export type { MatchAnswers, MatchCategoryConfig, MatchQuestion, MatchQuestionOption, MatchRouteMeta } from "@/lib/match.en";

export const MATCH_LAST_CATEGORY_KEY = en.MATCH_LAST_CATEGORY_KEY;
export const MATCH_CONFIG = en.MATCH_CONFIG;

function getMatchContent(locale: SiteLocale = "en") {
  return locale === "zh" ? zh : en;
}

export function getMatchConfig(category: CategoryKey, locale: SiteLocale = "en"): MatchCategoryConfig {
  return getMatchContent(locale).MATCH_CONFIG[category];
}

export function getMatchDraftStorageKey(category: CategoryKey): string {
  return en.getMatchDraftStorageKey(category);
}

export function normalizeMatchAnswers(category: CategoryKey, input: MatchAnswers, locale: SiteLocale = "en"): MatchAnswers {
  const config = getMatchConfig(category, locale);
  const output: MatchAnswers = {};

  for (const step of config.steps) {
    const raw = String(input[step.key] || "").trim();
    const isValid = step.options.some((option) => option.value === raw);
    if (!isValid) break;
    output[step.key] = raw;
  }

  return output;
}

export function isMatchComplete(category: CategoryKey, answers: MatchAnswers, locale: SiteLocale = "en"): boolean {
  const normalized = normalizeMatchAnswers(category, answers, locale);
  return getNextUnansweredIndex(category, normalized, locale) >= getMatchConfig(category, locale).steps.length;
}

export function getNextUnansweredIndex(category: CategoryKey, answers: MatchAnswers, locale: SiteLocale = "en"): number {
  const normalized = normalizeMatchAnswers(category, answers, locale);
  const steps = getMatchConfig(category, locale).steps;
  const index = steps.findIndex((step) => !normalized[step.key]);
  return index === -1 ? steps.length : index;
}

export function countAnsweredSteps(category: CategoryKey, answers: MatchAnswers, locale: SiteLocale = "en"): number {
  return Object.keys(normalizeMatchAnswers(category, answers, locale)).length;
}

export function getMatchQuestion(category: CategoryKey, questionKey: string, locale: SiteLocale = "en"): MatchQuestion | null {
  return getMatchConfig(category, locale).steps.find((step) => step.key === questionKey) || null;
}

export function getMatchChoice(
  category: CategoryKey,
  questionKey: string,
  value: string,
  locale: SiteLocale = "en",
): MatchQuestionOption | null {
  const question = getMatchQuestion(category, questionKey, locale);
  if (!question) return null;
  return question.options.find((option) => option.value === value) || null;
}

export function getMatchRouteMeta(category: CategoryKey, routeKey: string | null | undefined, locale: SiteLocale = "en"): MatchRouteMeta | null {
  const key = String(routeKey || "").trim();
  if (!key) return null;
  return getMatchConfig(category, locale).routes[key] || null;
}

export function getSelectionDisplayTitle(category: CategoryKey, routeKey: string | null | undefined, locale: SiteLocale = "en"): string {
  return getMatchRouteMeta(category, routeKey, locale)?.title || getCategoryMeta(category, locale)?.label || category;
}
