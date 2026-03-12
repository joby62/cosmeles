"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MobileLocationConsent from "@/components/mobile/MobileLocationConsent";
import {
  isCompleteLotionSignals,
  lotionChoiceLabel,
  normalizeLotionSignals,
  toLotionSearchParams,
  type LotionSignals,
} from "@/lib/mobile/lotionDecision";
import {
  LOTION_LAST_RESULT_QUERY_KEY,
  LOTION_PROFILE_DRAFT_KEY,
} from "@/lib/mobile/lotionFlowStorage";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";

type StepKey = keyof LotionSignals;
type OptionValue = "A" | "B" | "C" | "D" | "E";
type Option = { value: OptionValue; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "q1",
    title: "Q1 气候环境与当前季节",
    note: "先确定环境权重，决定保湿和清爽的底盘。",
    options: [
      { value: "A", label: "A. 干燥寒冷 / 长时间待在暖气房", sub: "优先提高封闭保湿能力" },
      { value: "B", label: "B. 炎热潮湿 / 夏季易出汗环境", sub: "优先轻薄吸收，避免闷黏" },
      { value: "C", label: "C. 换季温差大 / 经常刮风", sub: "优先平衡修护与舒适感" },
      { value: "D", label: "D. 气候温和 / 室内温湿度适宜", sub: "按功效诉求做收敛" },
    ],
  },
  {
    key: "q2",
    title: "Q2 身体肌肤耐受度",
    note: "安全优先，这一步会触发敏感掩码。",
    options: [
      { value: "A", label: "A. 极度敏感", sub: "易泛红干痒，需严格避刺激" },
      { value: "B", label: "B. 屏障健康", sub: "耐受较强，可考虑功效型路线" },
    ],
  },
  {
    key: "q3",
    title: "Q3 最核心的皮肤痛点",
    note: "这一题主导路线归属和风险隔离。",
    options: [
      { value: "A", label: "A. 极度干屑", sub: "重点缓解干裂瘙痒和脱屑" },
      { value: "B", label: "B. 躯干痘痘", sub: "重点清痘并避免闷痘" },
      { value: "C", label: "C. 粗糙颗粒", sub: "重点改善鸡皮和粗糙角质" },
      { value: "D", label: "D. 暗沉色差", sub: "重点提亮和均匀肤色" },
      { value: "E", label: "E. 状态正常", sub: "以维稳和体验感为主" },
    ],
  },
  {
    key: "q4",
    title: "Q4 身体乳质地与肤感偏好",
    note: "按肤感偏好微调，不越过风险掩码边界。",
    options: [
      { value: "A", label: "A. 秒吸收的轻薄水感", sub: "最怕粘腻沾衣，偏好清爽" },
      { value: "B", label: "B. 适中滋润的丝滑乳液感", sub: "希望保湿与肤感平衡" },
      { value: "C", label: "C. 强包裹的丰润油膏感", sub: "需要厚重膜感与修护感" },
    ],
  },
  {
    key: "q5",
    title: "Q5 特殊限制与诉求",
    note: "最后一步做安全过滤与体验偏好收敛。",
    options: [
      { value: "A", label: "A. 极致纯净", sub: "孕哺期或严格排斥香精/色素/防腐剂" },
      { value: "B", label: "B. 情绪留香", sub: "希望有明显调香和伪体香体验" },
      { value: "C", label: "C. 无特殊限制", sub: "更看重实际功效表现" },
    ],
  },
];

function normalizeSequentialSignals(input: LotionSignals): LotionSignals {
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

function firstUnansweredIndex(signals: LotionSignals): number {
  if (!signals.q1) return 0;
  if (!signals.q2) return 1;
  if (!signals.q3) return 2;
  if (!signals.q4) return 3;
  if (!signals.q5) return 4;
  return 4;
}

function signalsFromSearchParams(searchParams: Pick<URLSearchParams, "get">): LotionSignals {
  const parsed = normalizeLotionSignals({
    q1: searchParams.get("q1") ?? undefined,
    q2: searchParams.get("q2") ?? undefined,
    q3: searchParams.get("q3") ?? undefined,
    q4: searchParams.get("q4") ?? undefined,
    q5: searchParams.get("q5") ?? undefined,
  });
  return normalizeSequentialSignals(parsed);
}

export default function LotionProfileFlowClient() {
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
      return value ? lotionChoiceLabel(key, value) : null;
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
    const raw = window.localStorage.getItem(LOTION_PROFILE_DRAFT_KEY);
    if (!raw) return;
    try {
      const restored = normalizeSequentialSignals(JSON.parse(raw) as LotionSignals);
      if (!restored.q1 && !restored.q2 && !restored.q3 && !restored.q4 && !restored.q5) return;
      if (isCompleteLotionSignals(restored)) {
        window.localStorage.removeItem(LOTION_PROFILE_DRAFT_KEY);
        return;
      }
      const nextIdx = firstUnansweredIndex(restored);
      const qp = toLotionSearchParams(restored);
      applyResultCtaAttribution(qp, resultAttribution);
      qp.set("step", String(nextIdx + 1));
      router.replace(`/m/lotion/profile?${qp.toString()}`, { scroll: false });
      window.requestAnimationFrame(() => scrollToStep(nextIdx, "auto"));
    } catch {
      window.localStorage.removeItem(LOTION_PROFILE_DRAFT_KEY);
    }
  }, [resultAttribution, router, scrollToStep, signals.q1, signals.q2, signals.q3, signals.q4, signals.q5]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!signals.q1 && !signals.q2 && !signals.q3 && !signals.q4 && !signals.q5) {
      window.localStorage.removeItem(LOTION_PROFILE_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(LOTION_PROFILE_DRAFT_KEY, JSON.stringify(signals));
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
      const next: LotionSignals = { ...signals };

      if (step.key === "q1") {
        next.q1 = value as LotionSignals["q1"];
        next.q2 = undefined;
        next.q3 = undefined;
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q2") {
        if (!next.q1) return;
        next.q2 = value as LotionSignals["q2"];
        next.q3 = undefined;
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q3") {
        if (!next.q1 || !next.q2) return;
        next.q3 = value as LotionSignals["q3"];
        next.q4 = undefined;
        next.q5 = undefined;
      } else if (step.key === "q4") {
        if (!next.q1 || !next.q2 || !next.q3) return;
        next.q4 = value as LotionSignals["q4"];
        next.q5 = undefined;
      } else {
        if (!next.q1 || !next.q2 || !next.q3 || !next.q4) return;
        next.q5 = value as LotionSignals["q5"];
      }

      const merged = normalizeSequentialSignals(next);
      const qp = toLotionSearchParams(merged);
      applyResultCtaAttribution(qp, resultAttribution);

      if (isCompleteLotionSignals(merged)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(LOTION_PROFILE_DRAFT_KEY);
          window.localStorage.setItem(LOTION_LAST_RESULT_QUERY_KEY, toLotionSearchParams(merged).toString());
        }
        router.push(`/m/lotion/resolve?${qp.toString()}`);
        return;
      }

      const nextIndex = firstUnansweredIndex(merged);
      qp.set("step", String(nextIndex + 1));
      router.replace(`/m/lotion/profile?${qp.toString()}`, { scroll: false });
      window.setTimeout(() => scrollToStep(nextIndex, "smooth"), 48);
    },
    [resultAttribution, router, scrollToStep, signals],
  );

  const resetAll = useCallback(() => {
    const qp = new URLSearchParams();
    applyResultCtaAttribution(qp, resultAttribution);
    qp.set("step", "1");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOTION_PROFILE_DRAFT_KEY);
    }
    router.replace(`/m/lotion/profile?${qp.toString()}`, { scroll: false });
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
            <div className="m-profile-step-index">润肤霜决策 · 第 {stepIndex + 1}/{STEPS.length} 步</div>
            <TitleTag className="m-profile-step-title">{step.title}</TitleTag>
            <p className="m-profile-step-note">{step.note}</p>
            {stepIndex === 0 && !selected ? <MobileLocationConsent /> : null}

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
                    ? `已选择：${lotionChoiceLabel(step.key, selected)}`
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
