"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileLocationConsent from "@/components/mobile/MobileLocationConsent";
import {
  listConditionerProfileSteps,
  type ConditionerProfileOption,
  type ConditionerStepKey,
} from "@/domain/mobile/decision/conditioner";
import {
  conditionerChoiceLabel,
  isCompleteConditionerSignals,
  normalizeConditionerSignals,
  toConditionerSearchParams,
  type ConditionerSignals,
} from "@/lib/mobile/conditionerDecision";
import {
  CONDITIONER_LAST_RESULT_QUERY_KEY,
  CONDITIONER_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/conditionerFlowStorage";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";

const STEPS = listConditionerProfileSteps();

function normalizeSequentialSignals(input: ConditionerSignals): ConditionerSignals {
  const cQ1 = input.c_q1;
  const cQ2 = cQ1 ? input.c_q2 : undefined;
  const cQ3 = cQ1 && cQ2 ? input.c_q3 : undefined;
  return { c_q1: cQ1, c_q2: cQ2, c_q3: cQ3 };
}

function parseStep(raw: string | null): number {
  const num = Number(raw || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.min(Math.max(Math.round(num), 1), STEPS.length);
}

function firstUnansweredIndex(signals: ConditionerSignals): number {
  if (!signals.c_q1) return 0;
  if (!signals.c_q2) return 1;
  if (!signals.c_q3) return 2;
  return 2;
}

function signalsFromSearchParams(searchParams: Pick<URLSearchParams, "get">): ConditionerSignals {
  const parsed = normalizeConditionerSignals({
    c_q1: searchParams.get("c_q1") ?? undefined,
    c_q2: searchParams.get("c_q2") ?? undefined,
    c_q3: searchParams.get("c_q3") ?? undefined,
  });
  return normalizeSequentialSignals(parsed);
}

export default function ConditionerProfileFlowClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const restoredRef = useRef(false);
  const initialScrolledRef = useRef(false);

  const urlStep = useMemo(() => parseStep(searchParams.get("step")), [searchParams]);
  const urlSignals = useMemo(() => signalsFromSearchParams(searchParams), [searchParams]);
  const resultAttribution = useMemo(() => parseResultCtaAttribution(searchParams), [searchParams]);
  const returnTo = useMemo(() => parseMobileReturnTo(searchParams), [searchParams]);
  const signals = urlSignals;
  const answeredChoices = (["c_q1", "c_q2", "c_q3"] as ConditionerStepKey[])
    .map((key) => {
      const value = signals[key];
      return value ? conditionerChoiceLabel(key, value) : null;
    })
    .filter((value): value is string => Boolean(value));

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
    if (signals.c_q1 || signals.c_q2 || signals.c_q3) return;
    const raw = window.localStorage.getItem(CONDITIONER_PROFILE_DRAFT_KEY);
    if (!raw) return;
    try {
      const restored = normalizeSequentialSignals(JSON.parse(raw) as ConditionerSignals);
      if (!restored.c_q1 && !restored.c_q2 && !restored.c_q3) return;
      if (isCompleteConditionerSignals(restored)) {
        window.localStorage.removeItem(CONDITIONER_PROFILE_DRAFT_KEY);
        return;
      }
      const nextIdx = firstUnansweredIndex(restored);
      const qp = toConditionerSearchParams(restored);
      applyResultCtaAttribution(qp, resultAttribution);
      applyMobileReturnTo(qp, returnTo);
      qp.set("step", String(nextIdx + 1));
      router.replace(`/m/conditioner/profile?${qp.toString()}`, { scroll: false });
      window.requestAnimationFrame(() => scrollToStep(nextIdx, "auto"));
    } catch {
      window.localStorage.removeItem(CONDITIONER_PROFILE_DRAFT_KEY);
    }
  }, [resultAttribution, returnTo, router, scrollToStep, signals.c_q1, signals.c_q2, signals.c_q3]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!signals.c_q1 && !signals.c_q2 && !signals.c_q3) {
      window.localStorage.removeItem(CONDITIONER_PROFILE_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(CONDITIONER_PROFILE_DRAFT_KEY, JSON.stringify(signals));
  }, [signals]);

  useEffect(() => {
    if (initialScrolledRef.current) return;
    initialScrolledRef.current = true;
    const target = Math.min(urlStep - 1, firstUnansweredIndex(signals));
    window.requestAnimationFrame(() => scrollToStep(target, "auto"));
  }, [scrollToStep, signals, urlStep]);

  const handleSelect = useCallback(
    (stepIndex: number, value: ConditionerProfileOption["value"]) => {
      const step = STEPS[stepIndex];
      const next: ConditionerSignals = { ...signals };

      if (step.key === "c_q1") {
        next.c_q1 = value;
        next.c_q2 = undefined;
        next.c_q3 = undefined;
      } else if (step.key === "c_q2") {
        if (!next.c_q1) return;
        next.c_q2 = value;
        next.c_q3 = undefined;
      } else {
        if (!next.c_q1 || !next.c_q2) return;
        next.c_q3 = value;
      }

      const merged = normalizeSequentialSignals(next);
      const qp = toConditionerSearchParams(merged);
      applyResultCtaAttribution(qp, resultAttribution);
      applyMobileReturnTo(qp, returnTo);

      if (isCompleteConditionerSignals(merged)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(CONDITIONER_PROFILE_DRAFT_KEY);
          window.localStorage.setItem(CONDITIONER_LAST_RESULT_QUERY_KEY, toConditionerSearchParams(merged).toString());
        }
        router.push(`/m/conditioner/resolve?${qp.toString()}`);
        return;
      }

      const nextIndex = firstUnansweredIndex(merged);
      qp.set("step", String(nextIndex + 1));
      router.replace(`/m/conditioner/profile?${qp.toString()}`, { scroll: false });
      window.setTimeout(() => scrollToStep(nextIndex, "smooth"), 48);
    },
    [resultAttribution, returnTo, router, scrollToStep, signals],
  );

  const resetAll = useCallback(() => {
    const qp = new URLSearchParams();
    applyResultCtaAttribution(qp, resultAttribution);
    applyMobileReturnTo(qp, returnTo);
    qp.set("step", "1");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CONDITIONER_PROFILE_DRAFT_KEY);
    }
    router.replace(`/m/conditioner/profile?${qp.toString()}`, { scroll: false });
    window.setTimeout(() => scrollToStep(0, "smooth"), 24);
  }, [resultAttribution, returnTo, router, scrollToStep]);

  return (
    <section className="pb-8">
      {STEPS.map((step, stepIndex) => {
        const selected = signals[step.key] as ConditionerProfileOption["value"] | undefined;
        const enabled =
          stepIndex === 0 ||
          (stepIndex === 1 && Boolean(signals.c_q1)) ||
          (stepIndex === 2 && Boolean(signals.c_q1 && signals.c_q2));
        const TitleTag = stepIndex === 0 ? "h1" : "h2";

        return (
          <article
            key={step.key}
            ref={(node) => {
              stepRefs.current[stepIndex] = node;
            }}
            className="m-profile-step"
          >
            <div className="m-profile-step-index">护发素决策 · 第 {stepIndex + 1}/{STEPS.length} 步</div>
            <TitleTag className="m-profile-step-title">{step.title}</TitleTag>
            <p className="m-profile-step-note">{step.note}</p>
            {stepIndex === 0 && !selected ? <MobileLocationConsent scenario="conditioner" /> : null}

            <div className="mt-6 space-y-3">
              {step.options.map((opt) => {
                const active = selected === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!enabled}
                    aria-pressed={active}
                    onClick={() => handleSelect(stepIndex, opt.value)}
                    className={`m-profile-option ${active ? "m-profile-option-active" : ""} ${
                      !enabled ? "m-profile-option-locked" : ""
                    }`}
                  >
                    <div className="m-profile-option-label">{opt.label}</div>
                    <div className="m-profile-option-sub">{opt.sub}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-6">
              {enabled ? (
                <p className="m-profile-inline-hint">
                  {selected
                    ? `已选择：${conditionerChoiceLabel(step.key, selected)}`
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
            <div className="m-profile-summary-count">已答 {answeredChoices.length}/{STEPS.length}</div>
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
