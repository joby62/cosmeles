"use client";

import { useEffect, useRef } from "react";
import {
  resolveMobileSelection,
  type MobileSelectionCategory,
} from "@/lib/api";

type Props = {
  category: MobileSelectionCategory;
  answers: Record<string, string>;
};

function normalizeAnswers(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input || {})) {
    const normalizedKey = String(key || "").trim();
    const normalizedValue = String(value || "").trim();
    if (!normalizedKey || !normalizedValue) continue;
    out[normalizedKey] = normalizedValue;
  }
  return out;
}

export default function SelectionResultSessionBootstrap({
  category,
  answers,
}: Props) {
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    const normalizedAnswers = normalizeAnswers(answers);
    if (Object.keys(normalizedAnswers).length === 0) return;
    bootstrappedRef.current = true;
    void resolveMobileSelection({
      category,
      answers: normalizedAnswers,
      reuse_existing: true,
    }).catch(() => {});
  }, [answers, category]);

  return null;
}
