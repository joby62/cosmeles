"use client";

import { useEffect, useMemo, useState } from "react";

type Tone = "good" | "warn" | "info";

type RiskLevelMeta = {
  label: string;
  className: string;
};

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitLead(text: string): { lead: string; rest: string } {
  const line = normalizeLine(text);
  const matched = line.match(/^(.{2,16}?)[，、；：:]/);
  if (matched) {
    const lead = matched[1];
    const rest = normalizeLine(line.slice(matched[0].length));
    return { lead, rest };
  }
  if (line.length > 16) {
    return { lead: line.slice(0, 16), rest: line.slice(16).trim() };
  }
  return { lead: line, rest: "" };
}

function shortText(text: string, max = 48): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function getRiskLevelMeta(line: string): RiskLevelMeta {
  const text = normalizeLine(line);
  if (/风险程度高|高风险|严重|急性|禁用|避免|过敏|炎症|灼|红肿|糜烂|强刺激|明显加重/.test(text)) {
    return {
      label: "高风险",
      className: "m-wiki-risk-chip m-wiki-risk-high",
    };
  }
  if (/风险程度中|中风险|可能|谨慎|注意|不适|刺激|泛红|瘙痒|影响/.test(text)) {
    return {
      label: "中风险",
      className: "m-wiki-risk-chip m-wiki-risk-medium",
    };
  }
  return {
    label: "低风险",
    className: "m-wiki-risk-chip m-wiki-risk-low",
  };
}

function toneClass(tone: Tone): { bullet: string; chip: string } {
  if (tone === "good") {
    return {
      bullet: "bg-[#4dd7a8]",
      chip: "m-wiki-tag m-wiki-tag-good",
    };
  }
  if (tone === "warn") {
    return {
      bullet: "bg-[#ff8f8f]",
      chip: "m-wiki-tag m-wiki-tag-warn",
    };
  }
  return {
    bullet: "bg-[#6bb4ff]",
    chip: "m-wiki-tag m-wiki-tag-info",
  };
}

export function InsightSheetCard({
  title,
  tone,
  items,
  summary,
  digestTags = [],
  emptyText,
  showRiskLevel = false,
}: {
  title: string;
  tone: Tone;
  items: string[];
  summary: string;
  digestTags?: string[];
  emptyText: string;
  showRiskLevel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasItems = items.length > 0;
  const palette = toneClass(tone);

  const summaryText = useMemo(() => {
    if (!hasItems) return emptyText;
    return shortText(normalizeLine(summary), 52);
  }, [emptyText, hasItems, summary]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <>
      <section className="m-wiki-card rounded-[22px] px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold text-white/92">{title}</h3>
          <button
            type="button"
            onClick={() => {
              if (hasItems) {
                setOpen(true);
              }
            }}
            disabled={!hasItems}
            className={`m-pressable inline-flex h-7 items-center rounded-full border px-3 text-[12px] font-medium ${
              hasItems
                ? "border-white/18 bg-white/[0.08] text-white/86 active:bg-white/[0.14]"
                : "cursor-not-allowed border-white/8 bg-white/[0.04] text-white/35"
            }`}
          >
            查看全部
          </button>
        </div>

        <p className="mt-2 line-clamp-2 text-[15px] leading-[1.52] text-white/82">{summaryText}</p>

        {digestTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {digestTags.map((tag) => (
              <span key={tag} className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] ${palette.chip}`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <p className="mt-2 text-[12px] text-white/50">
          {hasItems ? `首屏仅展示 1 条重点 · 共 ${items.length} 条` : emptyText}
        </p>
      </section>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={`${title}完整内容`}>
          <button
            type="button"
            aria-label="关闭弹层"
            onClick={() => {
              setOpen(false);
            }}
            className="m-wiki-sheet-mask absolute inset-0 backdrop-blur-sm"
          />

          <div className="m-wiki-sheet m-sheet-enter absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[30px] border shadow-[0_-28px_72px_rgba(0,0,0,0.56)] backdrop-blur-2xl">
            <div className="m-wiki-sheet-handle mx-auto mt-2 h-1 w-11 rounded-full" />
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <h4 className="text-[17px] font-semibold text-white/92">{title} · 全部内容</h4>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                className="m-pressable inline-flex h-8 items-center rounded-full border border-white/16 bg-white/[0.08] px-3 text-[12px] font-medium text-white/86 active:bg-white/[0.14]"
              >
                关闭
              </button>
            </div>

            <div className="max-h-[calc(82dvh-88px)] overflow-y-auto px-4 pb-6 pt-3">
              {hasItems ? (
                <ul className="space-y-2.5">
                  {items.map((line, index) => {
                    const { lead, rest } = splitLead(line);
                    const riskMeta = showRiskLevel ? getRiskLevelMeta(line) : null;
                    return (
                      <li key={`${line}-${index}`} className="m-wiki-sheet-item rounded-2xl border px-3 py-3">
                        {riskMeta ? (
                          <div className="mb-1.5">
                            <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold ${riskMeta.className}`}>
                              {riskMeta.label}
                            </span>
                          </div>
                        ) : null}
                        <p className="flex items-start gap-2 text-[14px] leading-[1.6] text-white/78">
                          <span className={`mt-[0.48em] h-1.5 w-1.5 shrink-0 rounded-full ${palette.bullet}`} />
                          <span>
                            <strong className="font-semibold text-white/92">{lead}</strong>
                            {rest ? `，${rest}` : ""}
                          </span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-[1.5] text-white/58">{emptyText}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
