"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type StepKey = keyof ShampooSignals;
type Option = { value: "A" | "B" | "C" | "D"; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "q1",
    title: "你平时多久会感觉头发变油？",
    note: "选最接近你日常状态的一项。",
    options: [
      { value: "A", label: "A. 一天不洗就塌/油", sub: "先偏向控油清洁底色" },
      { value: "B", label: "B. 2-3天洗一次正好", sub: "先偏向温和平衡底色" },
      { value: "C", label: "C. 3天以上不洗也不油", sub: "先偏向滋润舒适底色" },
    ],
  },
  {
    key: "q2",
    title: "你现在有没有明显头皮困扰？",
    note: "选最符合你当前阶段的核心痛点。",
    options: [
      { value: "A", label: "A. 有头屑且发痒（真菌）", sub: "优先走去屑止痒方向" },
      { value: "B", label: "B. 头皮发红/刺痛/长痘（敏感）", sub: "强约束屏障与温和方向" },
      { value: "C", label: "C. 掉发明显/发根脆弱（脱发）", sub: "强化头皮强韧与防脱方向" },
      { value: "D", label: "D. 无特殊感觉（健康）", sub: "回到常规平衡优化路线" },
    ],
  },
  {
    key: "q3",
    title: "你的发质更接近哪种状态？",
    note: "最后一步，选完就出最终答案。",
    options: [
      { value: "A", label: "A. 频繁染烫/干枯易断", sub: "加修护插件，减少脆断感" },
      { value: "B", label: "B. 细软塌/贴头皮", sub: "加轻盈插件，保留蓬松度" },
      { value: "C", label: "C. 原生发/健康", sub: "走简配插件，保持长期稳定" },
    ],
  },
];

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
  const signals = urlSignals;
  const answeredChoices = (["q1", "q2", "q3"] as StepKey[])
    .map((key) => {
      const value = signals[key];
      return value ? shampooChoiceLabel(key, value) : null;
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
      qp.set("step", String(nextIdx + 1));
      router.replace(`/m/shampoo/profile?${qp.toString()}`, { scroll: false });
      window.requestAnimationFrame(() => scrollToStep(nextIdx, "auto"));
    } catch {
      window.localStorage.removeItem(SHAMPOO_PROFILE_DRAFT_KEY);
    }
  }, [router, scrollToStep, urlSignals.q1, urlSignals.q2, urlSignals.q3]);

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
    (stepIndex: number, value: Option["value"]) => {
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

      if (isReadyShampooResult(merged)) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(SHAMPOO_PROFILE_DRAFT_KEY);
          window.localStorage.setItem(SHAMPOO_LAST_RESULT_QUERY_KEY, qp.toString());
        }
        router.push(`/m/shampoo/resolve?${qp.toString()}`);
        return;
      }

      const nextIndex = firstUnansweredIndex(merged);
      qp.set("step", String(nextIndex + 1));
      router.replace(`/m/shampoo/profile?${qp.toString()}`, { scroll: false });
      window.setTimeout(() => scrollToStep(nextIndex, "smooth"), 48);
    },
    [router, scrollToStep, signals],
  );

  const resetAll = useCallback(() => {
    const qp = new URLSearchParams();
    qp.set("step", "1");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SHAMPOO_PROFILE_DRAFT_KEY);
    }
    router.replace(`/m/shampoo/profile?${qp.toString()}`, { scroll: false });
    window.setTimeout(() => scrollToStep(0, "smooth"), 24);
  }, [router, scrollToStep]);

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
