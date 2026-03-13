"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileLocationConsent from "@/components/mobile/MobileLocationConsent";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import {
  applyResultCtaAttribution,
  parseResultCtaAttribution,
} from "@/lib/mobile/resultCtaAttribution";
import type { MobileSelectionCategory } from "@/lib/api";
import type {
  DecisionShellSearch,
  DecisionShellSignals,
} from "@/features/mobile-decision/decisionShellConfig";
import { getDecisionShellConfig } from "@/features/mobile-decision/decisionShellConfig";

export default function DecisionProfileShellClient({
  category,
}: {
  category: MobileSelectionCategory;
}) {
  const config = useMemo(() => getDecisionShellConfig(category), [category]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const restoredRef = useRef(false);
  const initialScrolledRef = useRef(false);

  const stepKeys = useMemo(() => config.steps.map((step) => step.key), [config.steps]);
  const urlStep = useMemo(() => parseStep(searchParams.get("step"), config.steps.length), [config.steps.length, searchParams]);
  const signals = useMemo(() => {
    const raw: DecisionShellSearch = {};
    for (const key of stepKeys) {
      raw[key] = searchParams.get(key) ?? undefined;
    }
    const normalized = config.normalizeSignals(raw);
    return normalizeSequentialSignals(stepKeys, normalized);
  }, [config, searchParams, stepKeys]);
  const resultAttribution = useMemo(() => parseResultCtaAttribution(searchParams), [searchParams]);
  const returnTo = useMemo(() => parseMobileReturnTo(searchParams), [searchParams]);
  const answeredChoices = useMemo(
    () =>
      stepKeys
        .map((key) => {
          const value = signals[key];
          return value ? config.getChoiceLabel(key, value) : null;
        })
        .filter((value): value is string => Boolean(value)),
    [config, signals, stepKeys],
  );

  const scrollToStep = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    if (typeof window === "undefined") return;
    const target = stepRefs.current[index];
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: Math.max(0, y), behavior });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || restoredRef.current) return;
    restoredRef.current = true;
    if (hasAnySignals(stepKeys, signals)) return;
    const raw = window.localStorage.getItem(config.profileDraftStorageKey);
    if (!raw) return;
    try {
      const restored = normalizeSequentialSignals(
        stepKeys,
        JSON.parse(raw) as DecisionShellSignals,
      );
      if (!hasAnySignals(stepKeys, restored)) return;
      if (config.isComplete(restored)) {
        window.localStorage.removeItem(config.profileDraftStorageKey);
        return;
      }
      const nextIndex = firstUnansweredIndex(stepKeys, restored);
      const nextParams = config.toSearchParams(restored);
      applyResultCtaAttribution(nextParams, resultAttribution);
      applyMobileReturnTo(nextParams, returnTo);
      nextParams.set("step", String(nextIndex + 1));
      router.replace(`/m/${config.category}/profile?${nextParams.toString()}`, { scroll: false });
      window.requestAnimationFrame(() => scrollToStep(nextIndex, "auto"));
    } catch {
      window.localStorage.removeItem(config.profileDraftStorageKey);
    }
  }, [
    config,
    resultAttribution,
    returnTo,
    router,
    scrollToStep,
    signals,
    stepKeys,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasAnySignals(stepKeys, signals)) {
      window.localStorage.removeItem(config.profileDraftStorageKey);
      return;
    }
    window.localStorage.setItem(config.profileDraftStorageKey, JSON.stringify(signals));
  }, [config.profileDraftStorageKey, signals, stepKeys]);

  useEffect(() => {
    if (initialScrolledRef.current) return;
    initialScrolledRef.current = true;
    const target = Math.min(urlStep - 1, firstUnansweredIndex(stepKeys, signals));
    window.requestAnimationFrame(() => scrollToStep(target, "auto"));
  }, [scrollToStep, signals, stepKeys, urlStep]);

  const handleSelect = useCallback(
    (stepIndex: number, value: string) => {
      if (!isStepEnabled(stepIndex, stepKeys, signals)) return;
      const stepKey = stepKeys[stepIndex];
      const next: DecisionShellSignals = { ...signals, [stepKey]: value };
      for (let index = stepIndex + 1; index < stepKeys.length; index += 1) {
        next[stepKeys[index]] = undefined;
      }

      const merged = normalizeSequentialSignals(stepKeys, next);
      const nextParams = config.toSearchParams(merged);
      applyResultCtaAttribution(nextParams, resultAttribution);
      applyMobileReturnTo(nextParams, returnTo);

      if (config.isComplete(merged)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(config.profileDraftStorageKey);
          window.localStorage.setItem(
            config.lastResultQueryStorageKey,
            config.toSearchParams(merged).toString(),
          );
        }
        router.push(`/m/${config.category}/resolve?${nextParams.toString()}`);
        return;
      }

      const nextIndex = firstUnansweredIndex(stepKeys, merged);
      nextParams.set("step", String(nextIndex + 1));
      router.replace(`/m/${config.category}/profile?${nextParams.toString()}`, { scroll: false });
      window.setTimeout(() => scrollToStep(nextIndex, "smooth"), 48);
    },
    [
      config,
      resultAttribution,
      returnTo,
      router,
      scrollToStep,
      signals,
      stepKeys,
    ],
  );

  const resetAll = useCallback(() => {
    const nextParams = new URLSearchParams();
    applyResultCtaAttribution(nextParams, resultAttribution);
    applyMobileReturnTo(nextParams, returnTo);
    nextParams.set("step", "1");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(config.profileDraftStorageKey);
    }
    router.replace(`/m/${config.category}/profile?${nextParams.toString()}`, { scroll: false });
    window.setTimeout(() => scrollToStep(0, "smooth"), 24);
  }, [config.category, config.profileDraftStorageKey, resultAttribution, returnTo, router, scrollToStep]);

  return (
    <section className="pb-8">
      {config.steps.map((step, stepIndex) => {
        const selected = signals[step.key];
        const enabled = isStepEnabled(stepIndex, stepKeys, signals);
        const TitleTag = stepIndex === 0 ? "h1" : "h2";

        return (
          <article
            key={step.key}
            ref={(node) => {
              stepRefs.current[stepIndex] = node;
            }}
            className="m-profile-step"
          >
            <div className="m-profile-step-index">
              {config.titlePrefix} · 第 {stepIndex + 1}/{config.steps.length} 步
            </div>
            <TitleTag className="m-profile-step-title">{step.title}</TitleTag>
            <p className="m-profile-step-note">{step.note}</p>
            {stepIndex === 0 && !selected ? (
              <MobileLocationConsent scenario={config.category} />
            ) : null}

            <div className="mt-6 space-y-3">
              {step.options.map((option) => {
                const active = selected === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!enabled}
                    aria-pressed={active}
                    onClick={() => handleSelect(stepIndex, option.value)}
                    className={`m-profile-option ${active ? "m-profile-option-active" : ""} ${
                      !enabled ? "m-profile-option-locked" : ""
                    }`}
                  >
                    <div className="m-profile-option-label">{option.label}</div>
                    <div className="m-profile-option-sub">{option.sub}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-6">
              {enabled ? (
                <p className="m-profile-inline-hint">
                  {selected
                    ? `已选择：${config.getChoiceLabel(step.key, selected)}`
                    : "选择后会自动滑到下一题，你也可以随时上滑修改。"}
                </p>
              ) : (
                <p className="m-profile-inline-hint">先完成上一题，再继续这一题。</p>
              )}
            </div>
          </article>
        );
      })}

      {answeredChoices.length > 0 ? (
        <div className="m-profile-summary">
          <div className="m-profile-summary-head">
            <div className="m-profile-summary-count">
              已答 {answeredChoices.length}/{config.steps.length}
            </div>
            <button type="button" onClick={resetAll} className="m-profile-summary-reset">
              重新开始
            </button>
          </div>
          <div className="m-profile-summary-list">
            {answeredChoices.map((label) => (
              <span key={label} className="m-profile-chip">
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function parseStep(raw: string | null, total: number): number {
  const parsed = Number(raw || "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.round(parsed), 1), Math.max(total, 1));
}

function normalizeSequentialSignals(
  stepKeys: readonly string[],
  input: DecisionShellSignals,
): DecisionShellSignals {
  const output: DecisionShellSignals = {};
  for (let index = 0; index < stepKeys.length; index += 1) {
    const key = stepKeys[index];
    const previousKey = index > 0 ? stepKeys[index - 1] : null;
    const unlocked = !previousKey || Boolean(output[previousKey]);
    const value = input[key];
    output[key] = unlocked && value ? value : undefined;
  }
  return output;
}

function firstUnansweredIndex(stepKeys: readonly string[], signals: DecisionShellSignals): number {
  for (let index = 0; index < stepKeys.length; index += 1) {
    if (!signals[stepKeys[index]]) return index;
  }
  return Math.max(stepKeys.length - 1, 0);
}

function hasAnySignals(stepKeys: readonly string[], signals: DecisionShellSignals): boolean {
  return stepKeys.some((key) => Boolean(signals[key]));
}

function isStepEnabled(
  stepIndex: number,
  stepKeys: readonly string[],
  signals: DecisionShellSignals,
): boolean {
  if (stepIndex <= 0) return true;
  for (let index = 0; index < stepIndex; index += 1) {
    if (!signals[stepKeys[index]]) return false;
  }
  return true;
}
