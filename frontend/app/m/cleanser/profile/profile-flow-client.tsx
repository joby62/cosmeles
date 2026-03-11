"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  cleanserChoiceLabel,
  isCompleteCleanserSignals,
  normalizeCleanserSignals,
  toCleanserSearchParams,
  type CleanserSignals,
} from "@/lib/mobile/cleanserDecision";
import {
  CLEANSER_LAST_RESULT_QUERY_KEY,
  CLEANSER_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/cleanserFlowStorage";

type StepKey = keyof CleanserSignals;
type OptionValue = "A" | "B" | "C" | "D" | "E";
type Option = { value: OptionValue; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "q1",
    title: "Q1 基础肤质与出油量",
    note: "先确定皮脂基线，决定清洁强度的主权重。",
    options: [
      { value: "A", label: "A. 大油田", sub: "全脸泛油，洗后很快回油" },
      { value: "B", label: "B. 混油皮", sub: "T区明显出油，U区正常或偏干" },
      { value: "C", label: "C. 中性/混干", sub: "出油正常，偶发干燥" },
      { value: "D", label: "D. 大干皮", sub: "极少出油，洗后易紧绷起皮" },
    ],
  },
  {
    key: "q2",
    title: "Q2 屏障健康与敏感度",
    note: "安全优先级最高，这一步会触发强制掩码。",
    options: [
      { value: "A", label: "A. 重度敏感", sub: "常泛红发痒，容易刺痛" },
      { value: "B", label: "B. 轻度敏感", sub: "偶尔泛红，需谨慎选品" },
      { value: "C", label: "C. 屏障健康", sub: "耐受稳定，对活性成分容忍更高" },
    ],
  },
  {
    key: "q3",
    title: "Q3 日常清洁负担",
    note: "根据彩妆/防晒负担修正洗净力需求。",
    options: [
      { value: "A", label: "A. 每天浓妆", sub: "常见防水妆或高倍防晒" },
      { value: "B", label: "B. 淡妆/通勤防晒", sub: "日常隔离或轻薄底妆" },
      { value: "C", label: "C. 仅素颜", sub: "只需清理皮脂与灰尘" },
    ],
  },
  {
    key: "q4",
    title: "Q4 面部特殊痛点",
    note: "这一题决定功能路径和排除策略。",
    options: [
      { value: "A", label: "A. 黑头与闭口粉刺", sub: "毛孔堵塞与脂栓明显" },
      { value: "B", label: "B. 红肿破口痘", sub: "处于炎症或破口阶段" },
      { value: "C", label: "C. 暗沉粗糙", sub: "角质堆积、肤色不匀" },
      { value: "D", label: "D. 极度缺水紧绷", sub: "洗后立刻干涩刺痛" },
      { value: "E", label: "E. 无明显痛点", sub: "以健康维稳为主" },
    ],
  },
  {
    key: "q5",
    title: "Q5 质地与洗后肤感",
    note: "最后一步按偏好做轻量收敛，不越过安全边界。",
    options: [
      { value: "A", label: "A. 喜欢丰富绵密泡沫", sub: "更有清洁仪式感" },
      { value: "B", label: "B. 喜欢绝对清爽感", sub: "追求更强去油触感" },
      { value: "C", label: "C. 喜欢保留水润滑感", sub: "抗拒洗后紧绷" },
      { value: "D", label: "D. 喜欢无泡/低泡温和感", sub: "只要温和不刺激" },
    ],
  },
];

function normalizeSequentialSignals(input: CleanserSignals): CleanserSignals {
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

function firstUnansweredIndex(signals: CleanserSignals): number {
  if (!signals.q1) return 0;
  if (!signals.q2) return 1;
  if (!signals.q3) return 2;
  if (!signals.q4) return 3;
  if (!signals.q5) return 4;
  return 4;
}

function signalsFromSearchParams(searchParams: Pick<URLSearchParams, "get">): CleanserSignals {
  const parsed = normalizeCleanserSignals({
    q1: searchParams.get("q1") ?? undefined,
    q2: searchParams.get("q2") ?? undefined,
    q3: searchParams.get("q3") ?? undefined,
    q4: searchParams.get("q4") ?? undefined,
    q5: searchParams.get("q5") ?? undefined,
  });
  return normalizeSequentialSignals(parsed);
}

export default function CleanserProfileFlowClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const restoredRef = useRef(false);
  const initialScrolledRef = useRef(false);

  const urlStep = useMemo(() => parseStep(searchParams.get("step")), [searchParams]);
  const urlSignals = useMemo(() => signalsFromSearchParams(searchParams), [searchParams]);
  const signals = urlSignals;
  const answeredChoices = (["q1", "q2", "q3", "q4", "q5"] as StepKey[])
    .map((key) => {
      const value = signals[key];
      return value ? cleanserChoiceLabel(key, value) : null;
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
    const raw = window.localStorage.getItem(CLEANSER_PROFILE_DRAFT_KEY);
    if (!raw) return;
    try {
      const restored = normalizeSequentialSignals(JSON.parse(raw) as CleanserSignals);
      if (!restored.q1 && !restored.q2 && !restored.q3 && !restored.q4 && !restored.q5) return;
      if (isCompleteCleanserSignals(restored)) {
        window.localStorage.removeItem(CLEANSER_PROFILE_DRAFT_KEY);
        return;
      }
      const nextIdx = firstUnansweredIndex(restored);
      const qp = toCleanserSearchParams(restored);
      qp.set("step", String(nextIdx + 1));
      router.replace(`/m/cleanser/profile?${qp.toString()}`, { scroll: false });
      window.requestAnimationFrame(() => scrollToStep(nextIdx, "auto"));
    } catch {
      window.localStorage.removeItem(CLEANSER_PROFILE_DRAFT_KEY);
    }
  }, [router, scrollToStep, signals.q1, signals.q2, signals.q3, signals.q4, signals.q5]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!signals.q1 && !signals.q2 && !signals.q3 && !signals.q4 && !signals.q5) {
      window.localStorage.removeItem(CLEANSER_PROFILE_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(CLEANSER_PROFILE_DRAFT_KEY, JSON.stringify(signals));
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
      const next: CleanserSignals = { ...signals };

      if (step.key === "q1") {
        next.q1 = value as CleanserSignals["q1"];
        next.q2 = undefined;
        next.q3 = undefined;
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q2") {
        if (!next.q1) return;
        next.q2 = value as CleanserSignals["q2"];
        next.q3 = undefined;
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q3") {
        if (!next.q1 || !next.q2) return;
        next.q3 = value as CleanserSignals["q3"];
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q4") {
        if (!next.q1 || !next.q2 || !next.q3) return;
        next.q4 = value as CleanserSignals["q4"];
        next.q5 = undefined;
      } else {
        if (!next.q1 || !next.q2 || !next.q3 || !next.q4) return;
        next.q5 = value as CleanserSignals["q5"];
      }

      const merged = normalizeSequentialSignals(next);
      const qp = toCleanserSearchParams(merged);

      if (isCompleteCleanserSignals(merged)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(CLEANSER_PROFILE_DRAFT_KEY);
          window.localStorage.setItem(CLEANSER_LAST_RESULT_QUERY_KEY, qp.toString());
        }
        router.push(`/m/cleanser/resolve?${qp.toString()}`);
        return;
      }

      const nextIndex = firstUnansweredIndex(merged);
      qp.set("step", String(nextIndex + 1));
      router.replace(`/m/cleanser/profile?${qp.toString()}`, { scroll: false });
      window.setTimeout(() => scrollToStep(nextIndex, "smooth"), 48);
    },
    [router, scrollToStep, signals],
  );

  const resetAll = useCallback(() => {
    const qp = new URLSearchParams();
    qp.set("step", "1");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CLEANSER_PROFILE_DRAFT_KEY);
    }
    router.replace(`/m/cleanser/profile?${qp.toString()}`, { scroll: false });
    window.setTimeout(() => scrollToStep(0, "smooth"), 24);
  }, [router, scrollToStep]);

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
            <div className="m-profile-step-index">洗面奶决策 · 第 {stepIndex + 1}/{STEPS.length} 步</div>
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
                    ? `已选择：${cleanserChoiceLabel(step.key, selected)}`
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
