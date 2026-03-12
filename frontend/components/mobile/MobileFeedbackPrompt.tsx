"use client";

import { useEffect, useMemo, useState } from "react";
import { getMobileAnalyticsSessionId, trackMobileEvent } from "@/lib/mobileAnalytics";

const FEEDBACK_SAMPLE_RATE = 0.35;
const FEEDBACK_STORAGE_PREFIX = "mx_mobile_feedback_prompt_closed:";

type FeedbackOption = {
  label: string;
  value: string;
};

type FeedbackConfig = {
  title: string;
  prompt: string;
  options: FeedbackOption[];
};

type Props = {
  promptKey: string;
  triggerReason: string;
  page: string;
  route: string;
  source?: string;
  category?: string | null;
  compareId?: string | null;
  stage?: string | null;
  stageLabel?: string | null;
  errorCode?: string | null;
  detail?: string | null;
  onDismiss?: () => void;
};

const DEFAULT_CONFIG: FeedbackConfig = {
  title: "帮我们改进这一段体验",
  prompt: "这一步哪里让你停下来了？",
  options: [
    { value: "hard_to_understand", label: "看不懂" },
    { value: "too_slow", label: "太慢了" },
    { value: "too_much_work", label: "太麻烦" },
    { value: "not_confident", label: "不信结果" },
  ],
};

const FEEDBACK_CONFIG_BY_TRIGGER: Record<string, FeedbackConfig> = {
  compare_upload_fail: {
    title: "上传这一步卡住了？",
    prompt: "最接近你感受的是哪一项？",
    options: [
      { value: "upload_problem", label: "上传有问题" },
      { value: "dont_know_what_to_upload", label: "不确定拍什么" },
      { value: "too_much_work", label: "太麻烦" },
      { value: "leave_for_now", label: "先不做了" },
    ],
  },
  compare_stage_error: {
    title: "这次分析没跑通",
    prompt: "最影响你继续操作的是哪一点？",
    options: [
      { value: "hard_to_understand", label: "报错看不懂" },
      { value: "too_slow", label: "太慢了" },
      { value: "not_confident", label: "结果不稳" },
      { value: "leave_for_now", label: "先放弃" },
    ],
  },
  compare_restore_failed: {
    title: "恢复上次任务时卡住了？",
    prompt: "你更想告诉我们哪一点？",
    options: [
      { value: "restore_unclear", label: "恢复不清楚" },
      { value: "hard_to_understand", label: "报错看不懂" },
      { value: "too_much_work", label: "太麻烦" },
      { value: "leave_for_now", label: "先退出" },
    ],
  },
};

function hashString(value: string): number {
  let hash = 0;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = (hash * 31 + value.charCodeAt(idx)) % 1000003;
  }
  return Math.abs(hash);
}

function shouldSamplePrompt(promptKey: string): boolean {
  if (typeof window === "undefined") return false;
  const sessionId = getMobileAnalyticsSessionId() || "anon";
  const bucket = hashString(`${sessionId}:${promptKey}`) % 100;
  return bucket < FEEDBACK_SAMPLE_RATE * 100;
}

function getStorageKey(promptKey: string): string {
  return `${FEEDBACK_STORAGE_PREFIX}${promptKey}`;
}

function shouldShowPrompt(promptKey: string): boolean {
  if (typeof window === "undefined") return false;
  if (window.sessionStorage.getItem(getStorageKey(promptKey))) return false;
  return shouldSamplePrompt(promptKey);
}

export default function MobileFeedbackPrompt({
  promptKey,
  triggerReason,
  page,
  route,
  source,
  category,
  compareId,
  stage,
  stageLabel,
  errorCode,
  detail,
  onDismiss,
}: Props) {
  const [visible, setVisible] = useState<boolean>(() => shouldShowPrompt(promptKey));
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const config = useMemo(() => FEEDBACK_CONFIG_BY_TRIGGER[triggerReason] || DEFAULT_CONFIG, [triggerReason]);

  useEffect(() => {
    if (!visible) return;
    void trackMobileEvent("feedback_prompt_show", {
      page,
      route,
      source,
      category,
      compare_id: compareId || undefined,
      stage: stage || undefined,
      stage_label: stageLabel || undefined,
      error_code: errorCode || undefined,
      trigger_reason: triggerReason,
    });
  }, [category, compareId, errorCode, page, route, source, stage, stageLabel, triggerReason, visible]);

  if (!visible || submitted) return null;

  const dismiss = (eventName: "feedback_skip" | "feedback_submit", extraProps: Record<string, unknown>) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(getStorageKey(promptKey), "1");
    }
    void trackMobileEvent(eventName, {
      page,
      route,
      source,
      category,
      compare_id: compareId || undefined,
      stage: stage || undefined,
      stage_label: stageLabel || undefined,
      error_code: errorCode || undefined,
      trigger_reason: triggerReason,
      ...extraProps,
    });
    setVisible(false);
    if (eventName === "feedback_submit") {
      setSubmitted(true);
    }
    onDismiss?.();
  };

  return (
    <aside className="mt-3 rounded-[22px] border border-[#cfe2ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-4 py-4 shadow-[0_10px_24px_rgba(36,80,163,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold tracking-[0.03em] text-[#2450a3]">{config.title}</div>
          <p className="mt-1 text-[13px] leading-[1.55] text-[#44618f]">{config.prompt}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            dismiss("feedback_skip", {
              skip_reason: "close",
            })
          }
          className="inline-flex h-8 items-center justify-center rounded-full border border-[#c8d8f2] px-3 text-[12px] font-medium text-[#5a739e] active:bg-white/65"
        >
          跳过
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {config.options.map((option) => {
          const selected = selectedReason === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedReason(option.value)}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                selected
                  ? "border-[#0071e3] bg-[#0071e3] text-white shadow-[0_8px_18px_rgba(0,113,227,0.22)]"
                  : "border-[#c7d8f4] bg-white/85 text-[#33527f] active:bg-[#eef4ff]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="可选：再补一句，让我们更好定位问题"
        rows={3}
        className="mt-3 w-full resize-none rounded-2xl border border-[#cfe0f8] bg-white/88 px-3 py-2 text-[13px] leading-[1.55] text-[#28405f] outline-none placeholder:text-[#8aa1c4]"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="line-clamp-2 text-[11px] leading-[1.5] text-[#6d83a9]">
          {detail ? `当前错误：${detail}` : "不会打断当前流程，只用于帮助我们定位最容易劝退的环节。"}
        </p>
        <button
          type="button"
          disabled={!selectedReason}
          onClick={() =>
            dismiss("feedback_submit", {
              reason_label: selectedReason,
              reason_text: note.trim() || undefined,
              reason_text_len: note.trim().length,
            })
          }
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-4 text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(0,113,227,0.22)] disabled:opacity-45"
        >
          提交
        </button>
      </div>
    </aside>
  );
}
