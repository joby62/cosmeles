import {
  appendSourceToPath,
  type DecisionResumeItem,
} from "@/domain/mobile/progress/decisionResume";
import {
  buildDecisionProfileEntryHref,
  DECISION_ENTRY_SOURCE,
} from "@/features/mobile-decision/decisionEntryHref";
import type { MobileSelectionCategory } from "@/lib/api";

export type DecisionHomePrimaryFlow =
  | {
      kind: "resume_profile" | "reopen_result";
      category: MobileSelectionCategory;
      href: string;
      resumeItem: DecisionResumeItem;
    }
  | {
      kind: "in_use_compare";
      category: MobileSelectionCategory;
      href: string;
    };

export function buildDecisionHomePrimaryHref(): string {
  return "/m/choose?source=home_primary_cta";
}

export function buildDecisionCompareEntryHref(
  category: MobileSelectionCategory | null,
): string {
  if (!category) return "/m/compare";
  return `/m/compare?category=${encodeURIComponent(category)}`;
}

export function buildDecisionChooseCategoryStartHref(
  category: MobileSelectionCategory,
): string {
  return buildDecisionProfileEntryHref({
    category,
    source: DECISION_ENTRY_SOURCE.chooseStart,
  });
}

export function buildDecisionResumeHref(
  item: DecisionResumeItem,
  source: string,
): string {
  return appendSourceToPath(item.targetPath, source);
}

export function resolveDecisionHomePrimaryFlow(options: {
  resumeItem: DecisionResumeItem | null;
  inUseCategory: MobileSelectionCategory | null;
}): DecisionHomePrimaryFlow | null {
  if (options.resumeItem) {
    return {
      kind: options.resumeItem.kind === "draft" ? "resume_profile" : "reopen_result",
      category: options.resumeItem.category,
      href: buildDecisionResumeHref(options.resumeItem, "home_resume"),
      resumeItem: options.resumeItem,
    };
  }
  if (options.inUseCategory) {
    return {
      kind: "in_use_compare",
      category: options.inUseCategory,
      href: buildDecisionCompareEntryHref(options.inUseCategory),
    };
  }
  return null;
}
