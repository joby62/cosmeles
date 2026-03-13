"use client";

import type { ReactNode } from "react";

type PreviewItem = {
  id: string;
  title: string;
  meta: string;
};

export default function MobileHistoryCleanupSheet({
  open,
  title,
  description,
  days,
  onDaysChange,
  filterControls,
  previewSummary,
  previewItems,
  previewLoading,
  applying,
  onPreview,
  onApply,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  days: number;
  onDaysChange: (value: number) => void;
  filterControls?: ReactNode;
  previewSummary: string | null;
  previewItems: PreviewItem[];
  previewLoading: boolean;
  applying: boolean;
  onPreview: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end bg-[rgba(6,10,18,0.52)] px-4 pb-5 backdrop-blur-[1.5px]"
      onClick={() => {
        if (previewLoading || applying) return;
        onClose();
      }}
    >
      <div
        className="w-full rounded-[28px] border border-[rgba(255,255,255,0.42)] bg-[rgba(255,255,255,0.96)] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.28)] dark:border-[rgba(130,166,224,0.3)] dark:bg-[rgba(19,30,47,0.96)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-2">
          <div className="text-[18px] font-semibold tracking-[-0.01em] text-black/90">{title}</div>
          <p className="mt-2 text-[13px] leading-[1.6] text-black/58">{description}</p>
        </div>

        <div className="mt-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">时间阈值</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[30, 60, 90, 180].map((value) => {
              const active = days === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onDaysChange(value)}
                  className={`inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-medium ${
                    active ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/68"
                  }`}
                >
                  {value} 天前
                </button>
              );
            })}
          </div>
        </div>

        {filterControls ? <div className="mt-4">{filterControls}</div> : null}

        <div className="mt-4 rounded-[22px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">预览</div>
          <div className="mt-2 text-[13px] leading-[1.6] text-black/58">
            {previewSummary || "先点“预览命中”，确认会删掉哪些陈旧记录。"}
          </div>
          {previewItems.length > 0 ? (
            <div className="mt-3 space-y-2">
              {previewItems.map((item) => (
                <div key={item.id} className="rounded-[16px] border border-black/8 bg-white px-3 py-3">
                  <div className="text-[13px] font-medium text-black/78">{item.title}</div>
                  <div className="mt-1 text-[12px] leading-[1.5] text-black/50">{item.meta}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={previewLoading || applying}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-black/12 bg-white text-[15px] font-semibold text-black/82 disabled:opacity-55"
          >
            {previewLoading ? "预览中..." : "预览命中"}
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={previewLoading || applying || !previewSummary}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#ff3b30] text-[15px] font-semibold text-white disabled:opacity-55"
          >
            {applying ? "删除中..." : "删除命中记录"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={previewLoading || applying}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-[rgba(23,35,55,0.14)] bg-[rgba(255,255,255,0.94)] text-[15px] font-medium text-black/78 disabled:opacity-55"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
