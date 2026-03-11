"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type StepKey = keyof ConditionerSignals;
type OptionValue = "A" | "B" | "C";
type Option = { value: OptionValue; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "c_q1",
    title: "Q1 发丝受损史",
    note: "先确认基础受损程度，作为修护权重底盘。",
    options: [
      { value: "A", label: "A. 频繁漂/染/烫 (干枯空洞)", sub: "高受损，优先修护与抗断裂能力" },
      { value: "B", label: "B. 偶尔染烫/经常使用热工具 (轻度受损)", sub: "中度受损，平衡修护与轻盈感" },
      { value: "C", label: "C. 原生发/几乎不折腾 (健康)", sub: "低受损，避免配方过重导致发丝过载" },
    ],
  },
  {
    key: "c_q2",
    title: "Q2 发丝物理形态",
    note: "这一步会触发质地防线，决定能否用重柔顺路线。",
    options: [
      { value: "A", label: "A. 细软少/极易贴头皮", sub: "优先轻盈蓬松，禁重度柔顺" },
      { value: "B", label: "B. 粗硬/沙发/天生毛躁", sub: "优先抗躁顺滑与服帖度" },
      { value: "C", label: "C. 正常适中", sub: "不偏科，按目标效果做收敛" },
    ],
  },
  {
    key: "c_q3",
    title: "Q3 当前最渴望的视觉效果",
    note: "最后一步，锁定主诉求并给出唯一推荐路径。",
    options: [
      { value: "A", label: "A. 刚染完，需要锁色/固色", sub: "优先锁色膜与色泽维持能力" },
      { value: "B", label: "B. 打结梳不开，需要极致顺滑", sub: "优先抗毛躁与梳理滑度" },
      { value: "C", label: "C. 发尾不干枯，保持自然蓬松就行", sub: "优先基础保湿和轻盈平衡" },
    ],
  },
];

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
  const signals = urlSignals;
  const answeredChoices = (["c_q1", "c_q2", "c_q3"] as StepKey[])
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
      qp.set("step", String(nextIdx + 1));
      router.replace(`/m/conditioner/profile?${qp.toString()}`, { scroll: false });
      window.requestAnimationFrame(() => scrollToStep(nextIdx, "auto"));
    } catch {
      window.localStorage.removeItem(CONDITIONER_PROFILE_DRAFT_KEY);
    }
  }, [router, scrollToStep, signals.c_q1, signals.c_q2, signals.c_q3]);

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
    (stepIndex: number, value: OptionValue) => {
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

      if (isCompleteConditionerSignals(merged)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(CONDITIONER_PROFILE_DRAFT_KEY);
          window.localStorage.setItem(CONDITIONER_LAST_RESULT_QUERY_KEY, qp.toString());
        }
        router.push(`/m/conditioner/resolve?${qp.toString()}`);
        return;
      }

      const nextIndex = firstUnansweredIndex(merged);
      qp.set("step", String(nextIndex + 1));
      router.replace(`/m/conditioner/profile?${qp.toString()}`, { scroll: false });
      window.setTimeout(() => scrollToStep(nextIndex, "smooth"), 48);
    },
    [router, scrollToStep, signals],
  );

  const resetAll = useCallback(() => {
    const qp = new URLSearchParams();
    qp.set("step", "1");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CONDITIONER_PROFILE_DRAFT_KEY);
    }
    router.replace(`/m/conditioner/profile?${qp.toString()}`, { scroll: false });
    window.setTimeout(() => scrollToStep(0, "smooth"), 24);
  }, [router, scrollToStep]);

  return (
    <section className="pb-8">
      {STEPS.map((step, stepIndex) => {
        const selected = signals[step.key] as OptionValue | undefined;
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
