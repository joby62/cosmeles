"use client";

import type { CSSProperties, DragEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getInitialLang, pickLang, subscribeLang, type Lang } from "@/lib/i18n";

type RangeKey = "3" | "5" | "7" | "30" | "all";
type ModuleFilter = "all" | GitModuleBucket;
type PanelId = "overview" | "trend" | "modules" | "impact" | "heatmap" | "top";

type GitModuleBucket = "mobile" | "backend" | "infra" | "mixed";

type GitChurnCommit = {
  hash: string;
  dateIso: string;
  dayKey: string;
  hour: number;
  weekday: number;
  subject: string;
  insertions: number;
  deletions: number;
  files: number;
  module: GitModuleBucket;
};

type GitChurnDay = {
  day: string;
  commits: number;
  insertions: number;
  deletions: number;
  net: number;
};

type GitChurnModuleTotal = {
  commits: number;
  insertions: number;
  deletions: number;
  net: number;
};

type GitDashboardData = {
  available: boolean;
  error: string | null;
  generatedAtIso: string;
  sinceDays: number;
  totals: {
    commits: number;
    insertions: number;
    deletions: number;
    net: number;
    files: number;
  };
  moduleTotals: Record<GitModuleBucket, GitChurnModuleTotal>;
  daily: GitChurnDay[];
  heatmap: number[][];
  commits: GitChurnCommit[];
};

export type GitDashboardBundle = Record<RangeKey, GitDashboardData>;

type CopyToken = {
  zh: string;
  en: string;
};

const MODULE_LABEL: Record<GitModuleBucket, CopyToken> = {
  mobile: { zh: "移动端", en: "Mobile" },
  backend: { zh: "后端", en: "Backend" },
  infra: { zh: "基础设施", en: "Infra" },
  mixed: { zh: "跨域", en: "Mixed" },
};

const MODULE_SCOPE_HINT: Record<GitModuleBucket, CopyToken> = {
  mobile: {
    zh: "frontend/app/m + components/mobile + lib/mobile",
    en: "frontend/app/m + components/mobile + lib/mobile",
  },
  backend: { zh: "backend/**", en: "backend/**" },
  infra: {
    zh: "frontend 非 mobile + deploy + docs + 治理文件",
    en: "frontend non-mobile + deploy + docs + governance",
  },
  mixed: {
    zh: "一次提交同时触达多个域",
    en: "single commit touched multiple domains",
  },
};

const MODULE_BAR_COLOR: Record<GitModuleBucket, string> = {
  mobile: "linear-gradient(90deg,rgba(8,145,178,0.95),rgba(14,165,233,0.92))",
  backend: "linear-gradient(90deg,rgba(5,150,105,0.96),rgba(74,222,128,0.9))",
  infra: "linear-gradient(90deg,rgba(245,158,11,0.96),rgba(251,191,36,0.9))",
  mixed: "linear-gradient(90deg,rgba(147,51,234,0.95),rgba(236,72,153,0.88))",
};

const PANEL_LAYOUT: Record<PanelId, string> = {
  overview: "xl:col-span-12",
  trend: "xl:col-span-8",
  modules: "xl:col-span-4",
  impact: "xl:col-span-7",
  heatmap: "xl:col-span-5",
  top: "xl:col-span-12",
};

const PANEL_TITLE: Record<PanelId, CopyToken> = {
  overview: { zh: "代码流快照", en: "Codeflow Snapshot" },
  trend: { zh: "每日新增/删除趋势", en: "Daily Add/Delete Flow" },
  modules: { zh: "模块贡献", en: "Module Contribution" },
  impact: { zh: "提交波动条带", en: "Commit-by-Commit Strip" },
  heatmap: { zh: "周 / 小时热力图", en: "Weekday / Hour Heatmap" },
  top: { zh: "高影响提交", en: "Highest Impact Commits" },
};

const PANEL_SUBTITLE: Record<PanelId, CopyToken> = {
  overview: { zh: "来自 git numstat 的核心指标", en: "core metrics from git numstat" },
  trend: { zh: "上半区是新增，下半区是删除", en: "upper area = add, lower area = delete" },
  modules: { zh: "拖拽卡片可调整板块顺序", en: "drag cards to reorder this board" },
  impact: { zh: "从左到右为时间从旧到新", en: "left to right = old to new" },
  heatmap: { zh: "颜色越深表示提交越密集", en: "denser color means more commits" },
  top: { zh: "按新增 + 删除行数排序", en: "sorted by insertions + deletions" },
};

const RANGE_LABEL: Record<RangeKey, CopyToken> = {
  "3": { zh: "3天", en: "3D" },
  "5": { zh: "5天", en: "5D" },
  "7": { zh: "7天", en: "7D" },
  "30": { zh: "30天", en: "30D" },
  all: { zh: "全部", en: "All" },
};

const FILTER_LABEL: Record<ModuleFilter, CopyToken> = {
  all: { zh: "全部", en: "All" },
  mobile: { zh: "移动端", en: "Mobile" },
  backend: { zh: "后端", en: "Backend" },
  infra: { zh: "基础设施", en: "Infra" },
  mixed: { zh: "跨域", en: "Mixed" },
};

const WEEKDAY_LABELS: Record<Lang, readonly string[]> = {
  zh: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
} as const;
const WEEKDAY_INDEX = [1, 2, 3, 4, 5, 6, 0] as const;
const MODULE_ORDER: GitModuleBucket[] = ["mobile", "backend", "infra", "mixed"];
const DEFAULT_PANEL_ORDER: PanelId[] = ["overview", "trend", "modules", "impact", "heatmap", "top"];

function copy(lang: Lang, token: CopyToken): string {
  return pickLang(lang, token.zh, token.en);
}

function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US").format(value);
}

function formatSigned(value: number, lang: Lang): string {
  if (value > 0) return `+${formatNumber(value, lang)}`;
  if (value < 0) return `-${formatNumber(Math.abs(value), lang)}`;
  return "0";
}

function shortDate(day: string): string {
  return day.length >= 10 ? day.slice(5) : day;
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function ratioLabel(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function churn(insertions: number, deletions: number): number {
  return insertions + deletions;
}

function emptyModuleTotal(): GitChurnModuleTotal {
  return { commits: 0, insertions: 0, deletions: 0, net: 0 };
}

function areaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const trace = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  return `${trace} L${last.x.toFixed(2)} ${baselineY.toFixed(2)} L${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

function linePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function reorderPanels(order: PanelId[], fromId: PanelId, toId: PanelId): PanelId[] {
  const fromIndex = order.indexOf(fromId);
  const toIndex = order.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return order;
  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromId);
  return next;
}

function aggregateDashboard(dataset: GitDashboardData, filter: ModuleFilter) {
  const commits =
    filter === "all" ? dataset.commits : dataset.commits.filter((item) => item.module === filter);

  const dayOrder = dataset.daily.map((item) => item.day);
  const dayMap = new Map<string, GitChurnDay>();
  for (const day of dayOrder) {
    dayMap.set(day, {
      day,
      commits: 0,
      insertions: 0,
      deletions: 0,
      net: 0,
    });
  }

  const moduleTotals: Record<GitModuleBucket, GitChurnModuleTotal> = {
    mobile: emptyModuleTotal(),
    backend: emptyModuleTotal(),
    infra: emptyModuleTotal(),
    mixed: emptyModuleTotal(),
  };
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

  let insertions = 0;
  let deletions = 0;
  let files = 0;

  for (const commit of commits) {
    insertions += commit.insertions;
    deletions += commit.deletions;
    files += commit.files;

    const moduleRow = moduleTotals[commit.module];
    moduleRow.commits += 1;
    moduleRow.insertions += commit.insertions;
    moduleRow.deletions += commit.deletions;
    moduleRow.net = moduleRow.insertions - moduleRow.deletions;

    const daily = dayMap.get(commit.dayKey) ?? {
      day: commit.dayKey,
      commits: 0,
      insertions: 0,
      deletions: 0,
      net: 0,
    };
    daily.commits += 1;
    daily.insertions += commit.insertions;
    daily.deletions += commit.deletions;
    daily.net = daily.insertions - daily.deletions;
    dayMap.set(commit.dayKey, daily);

    if (commit.weekday >= 0 && commit.weekday < 7 && commit.hour >= 0 && commit.hour < 24) {
      heatmap[commit.weekday][commit.hour] += 1;
    }
  }

  const daily = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));
  const totalNet = insertions - deletions;
  return {
    commits,
    daily,
    heatmap,
    moduleTotals,
    totals: {
      commits: commits.length,
      insertions,
      deletions,
      files,
      net: totalNet,
    },
  };
}

function PanelShell({
  lang,
  panelId,
  dragging,
  over,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  rightSlot,
  children,
}: {
  lang: Lang;
  panelId: PanelId;
  dragging: boolean;
  over: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  rightSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`git-panel-card ${PANEL_LAYOUT[panelId]} rounded-[28px] border border-black/10 bg-white/88 shadow-[0_20px_56px_rgba(11,20,36,0.11)]`}
      data-dragging={dragging ? "true" : "false"}
      data-over={over ? "true" : "false"}
    >
      <header className="flex items-start justify-between border-b border-black/8 px-6 py-4">
        <div>
          <p className="text-[11px] tracking-[0.11em] text-black/50 uppercase">{copy(lang, PANEL_SUBTITLE[panelId])}</p>
          <h2 className="mt-1 text-[24px] leading-[1.03] font-semibold tracking-[-0.025em] text-black/88">
            {copy(lang, PANEL_TITLE[panelId])}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          <span
            className="git-panel-handle inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] text-black/45"
            title={pickLang(lang, "拖拽调整位置", "Drag to reorder")}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 6h8M8 12h8M8 18h8" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      </header>
      <div className="px-6 py-5">{children}</div>
    </article>
  );
}

export default function GitDashboardClient({ datasets }: { datasets: GitDashboardBundle }) {
  const [lang, setLang] = useState<Lang>(() => getInitialLang());
  const [range, setRange] = useState<RangeKey>("30");
  const [filter, setFilter] = useState<ModuleFilter>("all");
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(DEFAULT_PANEL_ORDER);
  const [draggingId, setDraggingId] = useState<PanelId | null>(null);
  const [overId, setOverId] = useState<PanelId | null>(null);

  useEffect(() => {
    return subscribeLang(() => setLang(getInitialLang()));
  }, []);

  const dataset = datasets[range];
  const weekdayLabels = WEEKDAY_LABELS[lang];
  const datetimeLocale = lang === "zh" ? "zh-CN" : "en-US";
  const rangeSummary =
    range === "all"
      ? pickLang(lang, "全部", "All history")
      : `${pickLang(lang, "最近", "Last")} ${copy(lang, RANGE_LABEL[range])}`;
  const fmtNum = (value: number) => formatNumber(value, lang);
  const fmtSigned = (value: number) => formatSigned(value, lang);

  const computed = useMemo(() => {
    return aggregateDashboard(dataset, filter);
  }, [dataset, filter]);
  const baselineAll = useMemo(() => {
    const allDataset = datasets.all;
    if (!allDataset?.available) return null;
    return aggregateDashboard(allDataset, filter);
  }, [datasets, filter]);

  const totalChurn = churn(computed.totals.insertions, computed.totals.deletions);
  const dailyForTrend = computed.daily.slice(-56);
  const moduleRows = MODULE_ORDER.map((bucket) => {
    const stats = computed.moduleTotals[bucket];
    return {
      bucket,
      ...stats,
      churn: churn(stats.insertions, stats.deletions),
    };
  }).sort((a, b) => b.churn - a.churn);
  const topCommits = [...computed.commits]
    .sort((a, b) => churn(b.insertions, b.deletions) - churn(a.insertions, a.deletions))
    .slice(0, 14);
  const stripCommits = computed.commits.slice(0, 120).reverse();

  const maxDaily = Math.max(1, ...dailyForTrend.map((row) => Math.max(row.insertions, row.deletions)));
  const maxModuleChurn = Math.max(1, ...moduleRows.map((row) => row.churn));
  const maxCommitChurn = Math.max(1, ...stripCommits.map((row) => churn(row.insertions, row.deletions)));
  const maxHeat = Math.max(1, ...computed.heatmap.flat());

  const chartHeight = 292;
  const chartWidth = Math.max(760, dailyForTrend.length * 16);
  const chartPadding = 34;
  const chartMid = chartHeight / 2;
  const chartAmplitude = chartHeight * 0.37;
  const chartStep =
    dailyForTrend.length > 1 ? (chartWidth - chartPadding * 2) / (dailyForTrend.length - 1) : 0;

  const plusPoints = dailyForTrend.map((row, index) => ({
    x: chartPadding + chartStep * index,
    y: chartMid - (row.insertions / maxDaily) * chartAmplitude,
  }));
  const minusPoints = dailyForTrend.map((row, index) => ({
    x: chartPadding + chartStep * index,
    y: chartMid + (row.deletions / maxDaily) * chartAmplitude,
  }));

  const plusArea = areaPath(plusPoints, chartMid);
  const minusArea = areaPath(minusPoints, chartMid);
  const plusLine = linePath(plusPoints);
  const minusLine = linePath(minusPoints);
  const labelStep = Math.max(1, Math.ceil(dailyForTrend.length / 9));
  const stripColumns: CSSProperties = {
    gridTemplateColumns: `repeat(${Math.max(stripCommits.length, 1)}, minmax(8px, 1fr))`,
  };

  const onPanelDragStart = (panelId: PanelId) => (event: DragEvent<HTMLElement>) => {
    setDraggingId(panelId);
    setOverId(panelId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", panelId);
  };

  const onPanelDragOver = (panelId: PanelId) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (draggingId && draggingId !== panelId) {
      setOverId(panelId);
    }
  };

  const onPanelDrop = (panelId: PanelId) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const dragId = draggingId ?? (event.dataTransfer.getData("text/plain") as PanelId);
    if (!dragId || dragId === panelId) {
      setDraggingId(null);
      setOverId(null);
      return;
    }
    setPanelOrder((prev) => reorderPanels(prev, dragId, panelId));
    setDraggingId(null);
    setOverId(null);
  };

  const onPanelDragEnd = () => {
    setDraggingId(null);
    setOverId(null);
  };

  if (!dataset.available) {
    return (
      <section className="mx-auto max-w-[1180px] px-6 pb-24 pt-16 md:px-10">
        <div className="rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_28px_80px_rgba(7,12,20,0.1)]">
          <p className="text-[12px] tracking-[0.14em] text-black/52 uppercase">{pickLang(lang, "Git 工程观测台", "Git Observatory")}</p>
          <h1 className="mt-2 text-[40px] leading-[1.04] font-semibold tracking-[-0.03em] text-black/88">
            {pickLang(lang, "无法读取本地 Git 历史", "Unable to read local Git history")}
          </h1>
          <p className="mt-4 max-w-[760px] text-[16px] leading-[1.7] text-black/64">
            {dataset.error || pickLang(lang, "当前运行环境可能没有 .git 仓库信息。", "The runtime may not include a .git directory.")}
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex items-center rounded-full border border-black/12 bg-black/[0.02] px-5 py-2 text-[13px] font-medium text-black/72"
          >
            {pickLang(lang, "返回首页", "Back to home")}
          </Link>
        </div>
      </section>
    );
  }

  const panels: Record<PanelId, ReactNode> = {
    overview: (
      <PanelShell
        lang={lang}
        panelId="overview"
        dragging={draggingId === "overview"}
        over={overId === "overview"}
        onDragStart={onPanelDragStart("overview")}
        onDragEnd={onPanelDragEnd}
        onDragOver={onPanelDragOver("overview")}
        onDrop={onPanelDrop("overview")}
        rightSlot={
          <button
            type="button"
            onClick={() => setPanelOrder(DEFAULT_PANEL_ORDER)}
            className="rounded-full border border-black/12 bg-black/[0.02] px-3 py-1 text-[11px] text-black/64 transition-colors hover:bg-black/[0.05]"
          >
            {pickLang(lang, "重置布局", "Reset Layout")}
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-black/10 bg-white/88 p-4">
            <p className="text-[11px] tracking-[0.08em] text-black/52 uppercase">{pickLang(lang, "新增行数", "Insertions")}</p>
            <p className="mt-2 text-[31px] leading-none font-semibold tracking-[-0.03em] text-emerald-700">
              +{fmtNum(computed.totals.insertions)}
            </p>
            <p className="mt-2 text-[12px] text-black/54">
              {pickLang(lang, "占全部新增", "Share of all insertions")}{" "}
              {ratioLabel(
                computed.totals.insertions,
                baselineAll?.totals.insertions ?? computed.totals.insertions,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-black/10 bg-white/88 p-4">
            <p className="text-[11px] tracking-[0.08em] text-black/52 uppercase">{pickLang(lang, "删除行数", "Deletions")}</p>
            <p className="mt-2 text-[31px] leading-none font-semibold tracking-[-0.03em] text-rose-700">
              -{fmtNum(computed.totals.deletions)}
            </p>
            <p className="mt-2 text-[12px] text-black/54">
              {pickLang(lang, "占全部删除", "Share of all deletions")}{" "}
              {ratioLabel(
                computed.totals.deletions,
                baselineAll?.totals.deletions ?? computed.totals.deletions,
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-black/10 bg-white/88 p-4">
            <p className="text-[11px] tracking-[0.08em] text-black/52 uppercase">{pickLang(lang, "提交次数", "Commits")}</p>
            <p className="mt-2 text-[31px] leading-none font-semibold tracking-[-0.03em] text-black/86">
              {fmtNum(computed.totals.commits)}
            </p>
            <p className="mt-2 text-[12px] text-black/54">
              {pickLang(lang, "影响文件", "Files touched")} {fmtNum(computed.totals.files)}
            </p>
          </article>

          <article className="rounded-2xl border border-black/10 bg-white/88 p-4">
            <p className="text-[11px] tracking-[0.08em] text-black/52 uppercase">{pickLang(lang, "净变化", "Net Delta")}</p>
            <p
              className={`mt-2 text-[31px] leading-none font-semibold tracking-[-0.03em] ${
                computed.totals.net >= 0 ? "text-cyan-700" : "text-orange-700"
              }`}
            >
              {fmtSigned(computed.totals.net)}
            </p>
            <p className="mt-2 text-[12px] text-black/54">{pickLang(lang, "新增 - 删除", "Insertions - Deletions")}</p>
          </article>
        </div>
      </PanelShell>
    ),

    trend: (
      <PanelShell
        lang={lang}
        panelId="trend"
        dragging={draggingId === "trend"}
        over={overId === "trend"}
        onDragStart={onPanelDragStart("trend")}
        onDragEnd={onPanelDragEnd}
        onDragOver={onPanelDragOver("trend")}
        onDrop={onPanelDrop("trend")}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[292px] w-full">
              <defs>
                <linearGradient id="gitPlusGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(16,185,129,0.78)" />
                  <stop offset="100%" stopColor="rgba(16,185,129,0.08)" />
                </linearGradient>
                <linearGradient id="gitMinusGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(244,63,94,0.08)" />
                  <stop offset="100%" stopColor="rgba(244,63,94,0.74)" />
                </linearGradient>
              </defs>

              <line
                x1={chartPadding}
                y1={chartMid}
                x2={chartWidth - chartPadding}
                y2={chartMid}
                stroke="rgba(17,24,39,0.22)"
                strokeDasharray="4 6"
              />
              <path d={plusArea} fill="url(#gitPlusGradient)" />
              <path d={minusArea} fill="url(#gitMinusGradient)" />
              <path d={plusLine} fill="none" stroke="rgba(5,150,105,0.92)" strokeWidth="2.4" strokeLinecap="round" />
              <path d={minusLine} fill="none" stroke="rgba(225,29,72,0.9)" strokeWidth="2.4" strokeLinecap="round" />

              {plusPoints.map((point, index) => {
                const row = dailyForTrend[index];
                return (
                  <circle key={row.day} cx={point.x} cy={point.y} r="2.1" fill="rgba(4,120,87,0.86)">
                    <title>{`${row.day} +${fmtNum(row.insertions)} / -${fmtNum(row.deletions)}`}</title>
                  </circle>
                );
              })}
            </svg>
            <div
              className="grid gap-1 text-[10px] text-black/46"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, dailyForTrend.length)}, minmax(0, 1fr))` }}
            >
              {dailyForTrend.map((row, index) => (
                <span
                  key={row.day}
                  className={index % labelStep === 0 || index === dailyForTrend.length - 1 ? "opacity-100" : "opacity-0"}
                >
                  {shortDate(row.day)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </PanelShell>
    ),

    modules: (
      <PanelShell
        lang={lang}
        panelId="modules"
        dragging={draggingId === "modules"}
        over={overId === "modules"}
        onDragStart={onPanelDragStart("modules")}
        onDragEnd={onPanelDragEnd}
        onDragOver={onPanelDragOver("modules")}
        onDrop={onPanelDrop("modules")}
      >
        <div className="space-y-3">
          {moduleRows.map((row) => (
            <div key={row.bucket}>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-black/80">{copy(lang, MODULE_LABEL[row.bucket])}</p>
                  <p className="text-[11px] text-black/52">{copy(lang, MODULE_SCOPE_HINT[row.bucket])}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-medium text-black/74">
                    {fmtNum(row.commits)} {pickLang(lang, "次提交", "commits")}
                  </p>
                  <p className={`text-[12px] ${row.net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {fmtSigned(row.net)}
                  </p>
                </div>
              </div>
              <div className="mt-2 h-[7px] rounded-full bg-black/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${clamp(2, (row.churn / maxModuleChurn) * 100, 100)}%`,
                    background: MODULE_BAR_COLOR[row.bucket],
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-black/54">
                +{fmtNum(row.insertions)} / -{fmtNum(row.deletions)} ({ratioLabel(row.churn, totalChurn)})
              </p>
            </div>
          ))}
        </div>
      </PanelShell>
    ),

    impact: (
      <PanelShell
        lang={lang}
        panelId="impact"
        dragging={draggingId === "impact"}
        over={overId === "impact"}
        onDragStart={onPanelDragStart("impact")}
        onDragEnd={onPanelDragEnd}
        onDragOver={onPanelDragOver("impact")}
        onDrop={onPanelDrop("impact")}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[740px]">
            <div className="grid h-[220px] gap-[3px] rounded-2xl border border-black/8 bg-black/[0.02] px-3 py-3" style={stripColumns}>
              {stripCommits.map((commit) => (
                <div key={commit.hash} className="flex flex-col">
                  <div className="flex h-1/2 items-end justify-center">
                    <div
                      className="w-full rounded-t-[3px] bg-emerald-500/82"
                      style={{ height: `${clamp(4, (commit.insertions / maxCommitChurn) * 100, 100)}%` }}
                      title={`${commit.hash.slice(0, 7)} +${fmtNum(commit.insertions)}`}
                    />
                  </div>
                  <div className="flex h-1/2 items-start justify-center">
                    <div
                      className="w-full rounded-b-[3px] bg-rose-500/82"
                      style={{ height: `${clamp(4, (commit.deletions / maxCommitChurn) * 100, 100)}%` }}
                      title={`${commit.hash.slice(0, 7)} -${fmtNum(commit.deletions)}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PanelShell>
    ),

    heatmap: (
      <PanelShell
        lang={lang}
        panelId="heatmap"
        dragging={draggingId === "heatmap"}
        over={overId === "heatmap"}
        onDragStart={onPanelDragStart("heatmap")}
        onDragEnd={onPanelDragEnd}
        onDragOver={onPanelDragOver("heatmap")}
        onDrop={onPanelDrop("heatmap")}
      >
        <div className="space-y-[7px]">
          {WEEKDAY_INDEX.map((actualDay, rowIndex) => (
            <div key={weekdayLabels[rowIndex]} className="flex items-center gap-3">
              <span className="w-9 text-right text-[11px] tracking-[0.04em] text-black/48">
                {weekdayLabels[rowIndex]}
              </span>
              <div className="grid flex-1 gap-[5px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                {computed.heatmap[actualDay].map((value, hour) => {
                  const alpha = value <= 0 ? 0.08 : 0.15 + (value / maxHeat) * 0.78;
                  return (
                    <div
                      key={`${actualDay}-${hour}`}
                      className="h-[11px] rounded-[4px] border border-black/[0.05]"
                      title={`${weekdayLabels[rowIndex]} ${hour}:00 · ${value} ${pickLang(lang, "次提交", "commits")}`}
                      style={{ backgroundColor: `rgba(14,165,233,${alpha})` }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PanelShell>
    ),

    top: (
      <PanelShell
        lang={lang}
        panelId="top"
        dragging={draggingId === "top"}
        over={overId === "top"}
        onDragStart={onPanelDragStart("top")}
        onDragEnd={onPanelDragEnd}
        onDragOver={onPanelDragOver("top")}
        onDrop={onPanelDrop("top")}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="w-[110px] px-3 text-left text-[11px] tracking-[0.06em] text-black/52 uppercase">{pickLang(lang, "提交", "Hash")}</th>
                <th className="w-[120px] px-3 text-left text-[11px] tracking-[0.06em] text-black/52 uppercase">{pickLang(lang, "日期", "Date")}</th>
                <th className="px-3 text-left text-[11px] tracking-[0.06em] text-black/52 uppercase">{pickLang(lang, "说明", "Subject")}</th>
                <th className="w-[120px] px-3 text-right text-[11px] tracking-[0.06em] text-black/52 uppercase">+ / -</th>
                <th className="w-[120px] px-3 text-right text-[11px] tracking-[0.06em] text-black/52 uppercase">{pickLang(lang, "模块", "Module")}</th>
              </tr>
            </thead>
            <tbody>
              {topCommits.map((commit) => (
                <tr key={commit.hash} className="rounded-xl border border-black/[0.07] bg-black/[0.02]">
                  <td className="rounded-l-xl px-3 py-3 text-[12px] font-medium text-black/74">{commit.hash.slice(0, 7)}</td>
                  <td className="px-3 py-3 text-[12px] text-black/62">{commit.dayKey}</td>
                  <td className="px-3 py-3 text-[13px] text-black/78">{commit.subject}</td>
                  <td className="px-3 py-3 text-right text-[12px] font-medium">
                    <span className="text-emerald-700">+{fmtNum(commit.insertions)}</span>
                    <span className="text-black/45"> / </span>
                    <span className="text-rose-700">-{fmtNum(commit.deletions)}</span>
                  </td>
                  <td className="rounded-r-xl px-3 py-3 text-right text-[12px] text-black/68">{copy(lang, MODULE_LABEL[commit.module])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelShell>
    ),
  };

  return (
    <>
      <section className="mx-auto max-w-[1280px] px-6 pb-24 pt-14 md:px-10">
        <header className="relative overflow-hidden rounded-[34px] border border-black/10 bg-[radial-gradient(circle_at_16%_0%,rgba(56,189,248,0.32),rgba(245,247,252,0.98)_42%),radial-gradient(circle_at_84%_12%,rgba(236,72,153,0.16),rgba(245,247,252,0)_48%),linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,246,255,0.94))] px-7 py-8 shadow-[0_34px_84px_rgba(11,22,38,0.14)] md:px-10 md:py-10">
          <p className="text-[12px] tracking-[0.16em] text-black/52 uppercase">{pickLang(lang, "Git 工程观测台", "Git Observatory")}</p>
          <h1 className="mt-2 max-w-[860px] text-[42px] leading-[0.98] font-semibold tracking-[-0.035em] text-black/90 md:text-[56px]">
            {pickLang(lang, "桌面代码流仪表盘", "Desktop Codeflow Panel")}
          </h1>
          <p className="mt-4 max-w-[900px] text-[16px] leading-[1.72] text-black/62 md:text-[17px]">
            {pickLang(
              lang,
              "数据来自真实 git log --numstat。支持时间范围切换、模块过滤，以及拖拽重排面板。",
              "Powered by real git log --numstat. Supports range switch, module filter, and drag-to-reorder panels.",
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-black/12 bg-white/74 p-1">
              {(Object.keys(RANGE_LABEL) as RangeKey[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                    range === item ? "bg-black text-white" : "text-black/68 hover:bg-black/[0.05]"
                  }`}
                >
                  {copy(lang, RANGE_LABEL[item])}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-full border border-black/12 bg-white/74 p-1">
              {(Object.keys(FILTER_LABEL) as ModuleFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                    filter === item ? "bg-black text-white" : "text-black/68 hover:bg-black/[0.05]"
                  }`}
                >
                  {copy(lang, FILTER_LABEL[item])}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[12px] text-black/48">
            {pickLang(lang, "当前视图：", "Current view:")} {rangeSummary} ·{" "}
            {pickLang(lang, "过滤：", "Filter:")} {copy(lang, FILTER_LABEL[filter])} ·{" "}
            {pickLang(lang, "生成时间", "Generated at")}{" "}
            {new Date(dataset.generatedAtIso).toLocaleString(datetimeLocale)}
          </p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12 xl:[grid-auto-flow:dense]">
          {panelOrder.map((panelId) => (
            <div key={panelId} className="contents">
              {panels[panelId]}
            </div>
          ))}
        </div>
      </section>

      <style jsx global>{`
        @keyframes gitPanelBreathe {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, -1px, 0) scale(1.008);
          }
        }

        .git-panel-card {
          transition: transform 240ms cubic-bezier(0.22, 0.78, 0.2, 1), box-shadow 240ms cubic-bezier(0.22, 0.78, 0.2, 1), border-color 220ms ease;
          will-change: transform;
        }

        .git-panel-card[data-dragging="true"] {
          z-index: 20;
          border-color: rgba(14, 165, 233, 0.52);
          box-shadow: 0 36px 72px rgba(14, 165, 233, 0.2);
          animation: gitPanelBreathe 2.1s cubic-bezier(0.22, 0.78, 0.2, 1) infinite;
        }

        .git-panel-card[data-over="true"] {
          transform: translateY(-2px);
          border-color: rgba(56, 189, 248, 0.48);
          box-shadow: 0 22px 52px rgba(14, 165, 233, 0.16);
        }

        .git-panel-card:hover {
          transform: translateY(-1px);
        }

        .git-panel-handle {
          cursor: grab;
        }

        .git-panel-handle:active {
          cursor: grabbing;
        }
      `}</style>
    </>
  );
}
