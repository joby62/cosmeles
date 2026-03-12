"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileLocationConsent from "@/components/mobile/MobileLocationConsent";
import {
  bodyWashChoiceLabel,
  isReadyBodyWashResult,
  normalizeBodyWashSignals,
  toBodyWashSearchParams,
  type BodyWashSignals,
} from "@/lib/mobile/bodywashDecision";
import {
  BODYWASH_LAST_RESULT_QUERY_KEY,
  BODYWASH_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/bodywashFlowStorage";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";

type StepKey = keyof BodyWashSignals;
type OptionValue = "A" | "B" | "C" | "D";
type Option = { value: OptionValue; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "q1",
    title: "Q1 当前气候与微环境更接近哪一类？",
    note: "这一步决定基础背景权重。",
    options: [
      { value: "A", label: "A. 干燥寒冷", sub: "北方冬季常见，易干裂脱屑" },
      { value: "B", label: "B. 干燥炎热", sub: "日照强、汗液蒸发快，易发烫紧绷" },
      { value: "C", label: "C. 潮湿闷热", sub: "汗油混合，体感厚重，细菌易滋生" },
      { value: "D", label: "D. 潮湿寒冷", sub: "阴冷+热水澡常导致过度去脂" },
    ],
  },
  {
    key: "q2",
    title: "Q2 你的皮肤基础耐受度？",
    note: "安全优先级最高，选完我们会先做硬过滤。",
    options: [
      { value: "A", label: "A. 极度敏感", sub: "遇热/摩擦易发红，换季刺痛瘙痒" },
      { value: "B", label: "B. 屏障健康", sub: "对多数产品耐受稳定" },
    ],
  },
  {
    key: "q3",
    title: "Q3 当前油脂与角质状态？",
    note: "这一步决定洗剂基底与功能主线。",
    options: [
      { value: "A", label: "A. 出油旺盛", sub: "前胸后背易长痘、午后粘腻" },
      { value: "B", label: "B. 缺油干涩", sub: "像砂纸，洗后不涂会发痒" },
      { value: "C", label: "C. 角质堆积", sub: "鸡皮肤/关节厚茧/暗沉" },
      { value: "D", label: "D. 状态正常", sub: "无明显油痘或粗糙痛点" },
    ],
  },
  {
    key: "q4",
    title: "Q4 你更喜欢哪种冲洗肤感？",
    note: "这一步是肤感修正系数。",
    options: [
      { value: "A", label: "A. 清爽干脆", sub: "讨厌残留，偏好“嘎吱响”" },
      { value: "B", label: "B. 柔滑滋润", sub: "接受轻膜感，喜欢乳液般包裹" },
    ],
  },
  {
    key: "q5",
    title: "Q5 有没有特殊限制？",
    note: "这一步用于成分过滤。",
    options: [
      { value: "A", label: "A. 极致纯净", sub: "备孕/母婴/强排香精场景" },
      { value: "B", label: "B. 情绪留香", sub: "希望有高级香氛体验" },
    ],
  },
];

function normalizeSequentialSignals(input: BodyWashSignals): BodyWashSignals {
  const q1 = input.q1;
  const q2 = q1 ? input.q2 : undefined;
  const q3 = q1 && q2 ? input.q3 : undefined;
  const q4 = q1 && q2 && q3 ? input.q4 : undefined;
  const q5 = q1 && q2 && q3 && q4 ? input.q5 : undefined;
  return { q1, q2, q3, q4, q5 };
}

function parseStep(raw: string | null): number {
  const num = Number(raw || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.min(Math.max(Math.round(num), 1), STEPS.length);
}

function firstUnansweredIndex(signals: BodyWashSignals): number {
  if (!signals.q1) return 0;
  if (!signals.q2) return 1;
  if (!signals.q3) return 2;
  if (!signals.q4) return 3;
  if (!signals.q5) return 4;
  return 4;
}

function signalsFromSearchParams(searchParams: Pick<URLSearchParams, "get">): BodyWashSignals {
  const parsed = normalizeBodyWashSignals({
    q1: searchParams.get("q1") ?? undefined,
    q2: searchParams.get("q2") ?? undefined,
    q3: searchParams.get("q3") ?? undefined,
    q4: searchParams.get("q4") ?? undefined,
    q5: searchParams.get("q5") ?? undefined,
  });
  return normalizeSequentialSignals(parsed);
}

export default function BodyWashProfileFlowClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const restoredRef = useRef(false);
  const initialScrolledRef = useRef(false);

  const urlStep = useMemo(() => parseStep(searchParams.get("step")), [searchParams]);
  const urlSignals = useMemo(() => signalsFromSearchParams(searchParams), [searchParams]);
  const resultAttribution = useMemo(() => parseResultCtaAttribution(searchParams), [searchParams]);
  const signals = urlSignals;
  const answeredChoices = (["q1", "q2", "q3", "q4", "q5"] as StepKey[])
    .map((key) => {
      const value = signals[key];
      return value ? bodyWashChoiceLabel(key, value) : null;
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
    if (signals.q1 || signals.q2 || signals.q3 || signals.q4 || signals.q5) return;
    const raw = window.localStorage.getItem(BODYWASH_PROFILE_DRAFT_KEY);
    if (!raw) return;
    try {
      const restored = normalizeSequentialSignals(JSON.parse(raw) as BodyWashSignals);
      if (!restored.q1 && !restored.q2 && !restored.q3 && !restored.q4 && !restored.q5) return;
      if (isReadyBodyWashResult(restored)) {
        window.localStorage.removeItem(BODYWASH_PROFILE_DRAFT_KEY);
        return;
      }
      const nextIdx = firstUnansweredIndex(restored);
      const qp = toBodyWashSearchParams(restored);
      applyResultCtaAttribution(qp, resultAttribution);
      qp.set("step", String(nextIdx + 1));
      router.replace(`/m/bodywash/profile?${qp.toString()}`, { scroll: false });
      window.requestAnimationFrame(() => scrollToStep(nextIdx, "auto"));
    } catch {
      window.localStorage.removeItem(BODYWASH_PROFILE_DRAFT_KEY);
    }
  }, [resultAttribution, router, scrollToStep, signals.q1, signals.q2, signals.q3, signals.q4, signals.q5]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!signals.q1 && !signals.q2 && !signals.q3 && !signals.q4 && !signals.q5) {
      window.localStorage.removeItem(BODYWASH_PROFILE_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(BODYWASH_PROFILE_DRAFT_KEY, JSON.stringify(signals));
  }, [signals]);

  useEffect(() => {
    if (initialScrolledRef.current) return;
    initialScrolledRef.current = true;
    const target = Math.min(urlStep - 1, firstUnansweredIndex(signals));
    window.requestAnimationFrame(() => scrollToStep(target, "auto"));
  }, [scrollToStep, signals, urlStep]);

  const handleSelect = useCallback(
    (stepIndex: number, value: OptionValue) => {
      const step = STEPS[stepIndex];
      const next: BodyWashSignals = { ...signals };

      if (step.key === "q1") {
        next.q1 = value as BodyWashSignals["q1"];
        next.q2 = undefined;
        next.q3 = undefined;
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q2") {
        if (!next.q1) return;
        next.q2 = value as BodyWashSignals["q2"];
        next.q3 = undefined;
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q3") {
        if (!next.q1 || !next.q2) return;
        next.q3 = value as BodyWashSignals["q3"];
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q4") {
        if (!next.q1 || !next.q2 || !next.q3) return;
        next.q4 = value as BodyWashSignals["q4"];
        next.q5 = undefined;
      } else {
        if (!next.q1 || !next.q2 || !next.q3 || !next.q4) return;
        next.q5 = value as BodyWashSignals["q5"];
      }

      const merged = normalizeSequentialSignals(next);
      const qp = toBodyWashSearchParams(merged);
      applyResultCtaAttribution(qp, resultAttribution);

      if (isReadyBodyWashResult(merged)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(BODYWASH_PROFILE_DRAFT_KEY);
          window.localStorage.setItem(BODYWASH_LAST_RESULT_QUERY_KEY, toBodyWashSearchParams(merged).toString());
        }
        router.push(`/m/bodywash/resolve?${qp.toString()}`);
        return;
      }

      const nextIndex = firstUnansweredIndex(merged);
      qp.set("step", String(nextIndex + 1));
      router.replace(`/m/bodywash/profile?${qp.toString()}`, { scroll: false });
      window.setTimeout(() => scrollToStep(nextIndex, "smooth"), 48);
    },
    [resultAttribution, router, scrollToStep, signals],
  );

  const resetAll = useCallback(() => {
    const qp = new URLSearchParams();
    applyResultCtaAttribution(qp, resultAttribution);
    qp.set("step", "1");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(BODYWASH_PROFILE_DRAFT_KEY);
    }
    router.replace(`/m/bodywash/profile?${qp.toString()}`, { scroll: false });
    window.setTimeout(() => scrollToStep(0, "smooth"), 24);
  }, [resultAttribution, router, scrollToStep]);

  return (
    <section className="pb-8">
      {STEPS.map((step, stepIndex) => {
        const selected = signals[step.key] as OptionValue | undefined;
        const enabled =
          stepIndex === 0 ||
          (stepIndex === 1 && Boolean(signals.q1)) ||
          (stepIndex === 2 && Boolean(signals.q1 && signals.q2)) ||
          (stepIndex === 3 && Boolean(signals.q1 && signals.q2 && signals.q3)) ||
          (stepIndex === 4 && Boolean(signals.q1 && signals.q2 && signals.q3 && signals.q4));
        const TitleTag = stepIndex === 0 ? "h1" : "h2";

        return (
          <article
            key={step.key}
            ref={(node) => {
              stepRefs.current[stepIndex] = node;
            }}
            className="m-profile-step"
          >
            <div className="m-profile-step-index">沐浴挑选 · 第 {stepIndex + 1}/{STEPS.length} 步</div>
            <TitleTag className="m-profile-step-title">{step.title}</TitleTag>
            <p className="m-profile-step-note">{step.note}</p>
            {stepIndex === 0 && !selected ? <MobileLocationConsent scenario="bodywash" /> : null}

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
                    ? `已选择：${bodyWashChoiceLabel(step.key, selected)}`
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
