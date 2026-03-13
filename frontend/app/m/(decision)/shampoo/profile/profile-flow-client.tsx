"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileLocationConsent from "@/components/mobile/MobileLocationConsent";
import { listShampooProfileSteps, type ShampooProfileOption, type ShampooStepKey } from "@/domain/mobile/decision/shampoo";
import {
  isReadyShampooResult,
  shampooChoiceLabel,
  toSignalSearchParams,
  type ShampooSignals,
} from "@/lib/mobile/shampooDecision";
import {
  SHAMPOO_LAST_RESULT_QUERY_KEY,
  SHAMPOO_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/shampooFlowStorage";
import { applyMobileReturnTo, parseMobileReturnTo } from "@/lib/mobile/flowReturn";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";

const STEPS = listShampooProfileSteps();

function normalizeSequentialSignals(input: ShampooSignals): ShampooSignals {
  const q1 = input.q1;
  const q2 = q1 ? input.q2 : undefined;
  const q3 = q1 && q2 ? input.q3 : undefined;
  return { q1, q2, q3 };
}

function parseStep(raw: string | null): number {
  const num = Number(raw || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.min(Math.max(Math.round(num), 1), STEPS.length);
}

function firstUnansweredIndex(signals: ShampooSignals): number {
  if (!signals.q1) return 0;
  if (!signals.q2) return 1;
  if (!signals.q3) return 2;
  return 2;
}

function signalsFromSearchParams(searchParams: Pick<URLSearchParams, "get">): ShampooSignals {
  const q1 = searchParams.get("q1");
  const q2 = searchParams.get("q2");
  const q3 = searchParams.get("q3");
  return normalizeSequentialSignals({
    q1: q1 === "A" || q1 === "B" || q1 === "C" ? q1 : undefined,
    q2: q2 === "A" || q2 === "B" || q2 === "C" || q2 === "D" ? q2 : undefined,
    q3: q3 === "A" || q3 === "B" || q3 === "C" ? q3 : undefined,
  });
}

export default function ShampooProfilePage() {
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
  const answeredChoices = (["q1", "q2", "q3"] as ShampooStepKey[])
    .map((key) => {
      const value = signals[key];
      return value ? shampooChoiceLabel(key as ShampooStepKey, value) : null;
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
    if (urlSignals.q1 || urlSignals.q2 || urlSignals.q3) return;
    const raw = window.localStorage.getItem(SHAMPOO_PROFILE_DRAFT_KEY);
    if (!raw) return;
    try {
      const restored = normalizeSequentialSignals(JSON.parse(raw) as ShampooSignals);
      if (!restored.q1 && !restored.q2 && !restored.q3) return;
      if (isReadyShampooResult(restored)) {
        window.localStorage.removeItem(SHAMPOO_PROFILE_DRAFT_KEY);
        return;
      }
      const nextIdx = firstUnansweredIndex(restored);
      const qp = toSignalSearchParams(restored);
      applyResultCtaAttribution(qp, resultAttribution);
      applyMobileReturnTo(qp, returnTo);
      qp.set("step", String(nextIdx + 1));
      router.replace(`/m/shampoo/profile?${qp.toString()}`, { scroll: false });
      window.requestAnimationFrame(() => scrollToStep(nextIdx, "auto"));
    } catch {
      window.localStorage.removeItem(SHAMPOO_PROFILE_DRAFT_KEY);
    }
  }, [resultAttribution, returnTo, router, scrollToStep, urlSignals.q1, urlSignals.q2, urlSignals.q3]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!signals.q1 && !signals.q2 && !signals.q3) {
      window.localStorage.removeItem(SHAMPOO_PROFILE_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(SHAMPOO_PROFILE_DRAFT_KEY, JSON.stringify(signals));
  }, [signals]);

  useEffect(() => {
    if (initialScrolledRef.current) return;
    initialScrolledRef.current = true;
    const target = Math.min(urlStep - 1, firstUnansweredIndex(urlSignals));
    window.requestAnimationFrame(() => scrollToStep(target, "auto"));
  }, [scrollToStep, urlSignals, urlStep]);

  const handleSelect = useCallback(
    (stepIndex: number, value: ShampooProfileOption["value"]) => {
      const step = STEPS[stepIndex];
      const next: ShampooSignals = { ...signals };
      if (step.key === "q1") {
        next.q1 = value as ShampooSignals["q1"];
        next.q2 = undefined;
        next.q3 = undefined;
      } else if (step.key === "q2") {
        if (!next.q1) return;
        next.q2 = value as ShampooSignals["q2"];
        next.q3 = undefined;
      } else {
        if (!next.q1 || !next.q2) return;
        next.q3 = value as ShampooSignals["q3"];
      }

      const merged = normalizeSequentialSignals(next);
      const qp = toSignalSearchParams(merged);
      applyResultCtaAttribution(qp, resultAttribution);
      applyMobileReturnTo(qp, returnTo);

      if (isReadyShampooResult(merged)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(SHAMPOO_PROFILE_DRAFT_KEY);
          window.localStorage.setItem(SHAMPOO_LAST_RESULT_QUERY_KEY, toSignalSearchParams(merged).toString());
        }
        router.push(`/m/shampoo/resolve?${qp.toString()}`);
        return;
      }

      const nextIndex = firstUnansweredIndex(merged);
      qp.set("step", String(nextIndex + 1));
      router.replace(`/m/shampoo/profile?${qp.toString()}`, { scroll: false });
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
      window.localStorage.removeItem(SHAMPOO_PROFILE_DRAFT_KEY);
    }
    router.replace(`/m/shampoo/profile?${qp.toString()}`, { scroll: false });
    window.setTimeout(() => scrollToStep(0, "smooth"), 24);
  }, [resultAttribution, returnTo, router, scrollToStep]);

  return (
    <section className="pb-8">
      {STEPS.map((step, stepIndex) => {
        const selected = signals[step.key];
        const enabled =
          stepIndex === 0 || (stepIndex === 1 && Boolean(signals.q1)) || (stepIndex === 2 && Boolean(signals.q1 && signals.q2));
        const TitleTag = stepIndex === 0 ? "h1" : "h2";

        return (
          <article
            key={step.key}
            ref={(node) => {
              stepRefs.current[stepIndex] = node;
            }}
            className="m-profile-step"
          >
            <div className="m-profile-step-index">洗发挑选 · 第 {stepIndex + 1}/{STEPS.length} 步</div>
            <TitleTag className="m-profile-step-title">{step.title}</TitleTag>
            <p className="m-profile-step-note">{step.note}</p>
            {stepIndex === 0 && !selected ? <MobileLocationConsent scenario="shampoo" /> : null}

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
                    ? `已选择：${shampooChoiceLabel(step.key, selected)}`
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
