"use client";

import { useEffect, useState } from "react";
import { listDecisionCategories } from "@/domain/mobile/decision/catalog";
import {
  normalizeDecisionCategory,
  readDecisionContinuationTarget,
  type DecisionContinuationTarget,
} from "@/domain/mobile/progress/decisionResume";
import type { MobileSelectionCategory } from "@/lib/api";

const DECISION_CATEGORY_KEYS = listDecisionCategories().map((item) => item.key);

type DecisionContinuationMap = {
  defaultTarget: DecisionContinuationTarget;
  resolveByCategory: (category: string | null | undefined) => DecisionContinuationTarget;
};

type UseDecisionContinuationOptions = {
  source: string;
  preferredCategory?: string | null;
};

export function useDecisionContinuationMap(
  options: UseDecisionContinuationOptions,
): DecisionContinuationMap | null {
  const source = String(options.source || "").trim();
  const preferredCategory = options.preferredCategory || null;
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setVersion((prev) => prev + 1);
    };
    const rafId = window.requestAnimationFrame(sync);
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (typeof window === "undefined") return null;

  const byCategory = {} as Record<MobileSelectionCategory, DecisionContinuationTarget>;
  for (const category of DECISION_CATEGORY_KEYS) {
    byCategory[category] = readDecisionContinuationTarget(window.localStorage, {
      source,
      preferredCategory: category,
    });
  }

  const normalizedPreferred = normalizeDecisionCategory(preferredCategory);
  const defaultTarget = normalizedPreferred
    ? byCategory[normalizedPreferred]
    : readDecisionContinuationTarget(window.localStorage, { source });
  void version;

  return {
    defaultTarget,
    resolveByCategory: (category) => {
      const normalized = normalizeDecisionCategory(category);
      if (!normalized) return defaultTarget;
      return byCategory[normalized];
    },
  };
}
