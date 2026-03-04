import type { CSSProperties } from "react";
import Link from "next/link";
import { getGitChurnDashboard, type GitChurnCommit, type GitModuleBucket } from "@/lib/mobile/gitChurn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

const MODULE_LABEL: Record<GitModuleBucket, string> = {
  mobile: "Mobile",
  backend: "Backend",
  infra: "Infra",
  mixed: "Mixed",
};

const MODULE_COLOR: Record<GitModuleBucket, string> = {
  mobile: "rgba(10,132,255,0.88)",
  backend: "rgba(52,199,89,0.86)",
  infra: "rgba(255,159,10,0.84)",
  mixed: "rgba(175,82,222,0.84)",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatSigned(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return `-${formatNumber(Math.abs(value))}`;
  return "0";
}

function shortSubject(subject: string): string {
  if (subject.length <= 64) return subject;
  return `${subject.slice(0, 61)}...`;
}

function shortDay(day: string): string {
  return day.length >= 10 ? day.slice(5) : day;
}

function tinyBarHeight(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "0%";
  return `${Math.max(4, (value / max) * 100)}%`;
}

function moduleScopeHint(bucket: GitModuleBucket): string {
  if (bucket === "mobile") return "frontend/app/m + components/mobile + lib/mobile";
  if (bucket === "backend") return "backend/**";
  if (bucket === "infra") return "其余路径（frontend 非 mobile、deploy、docs、.github）";
  return "一次提交同时触达多个域";
}

function churnOf(commit: GitChurnCommit): number {
  return commit.insertions + commit.deletions;
}

export default function MobileGitPage() {
  const data = getGitChurnDashboard({ sinceDays: 30, maxCommits: 180 });

  if (!data.available) {
    return (
      <section className="space-y-4 pb-8">
        <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] text-black/90 dark:text-white/92">
          Git 代码脉冲
        </h1>
        <div className="rounded-3xl border border-black/10 bg-white/92 p-4 text-[14px] text-black/70 shadow-[0_14px_34px_rgba(17,24,39,0.08)] dark:border-white/15 dark:bg-white/6 dark:text-white/70">
          <p>暂时拿不到 git 历史数据。</p>
          <p className="mt-2 text-[13px] text-black/55 dark:text-white/56">{data.error || "可能运行环境没有 .git 目录。"} </p>
        </div>
        <Link
          href="/m/about"
          className="inline-flex items-center rounded-full border border-black/12 bg-white/86 px-4 py-2 text-[13px] font-medium text-black/72 dark:border-white/20 dark:bg-white/8 dark:text-white/78"
        >
          返回关于页
        </Link>
      </section>
    );
  }

  const maxDailyChurn = Math.max(1, ...data.daily.map((item) => Math.max(item.insertions, item.deletions)));
  const maxHeat = Math.max(1, ...data.heatmap.flat());
  const maxCommitChurn = Math.max(1, ...data.commits.map(churnOf));
  const dailyColumns: CSSProperties = {
    gridTemplateColumns: `repeat(${Math.max(data.daily.length, 1)}, minmax(10px, 1fr))`,
  };

  const moduleRows = (Object.keys(data.moduleTotals) as GitModuleBucket[])
    .map((bucket) => {
      const row = data.moduleTotals[bucket];
      return {
        bucket,
        ...row,
        churn: row.insertions + row.deletions,
      };
    })
    .sort((a, b) => b.churn - a.churn);
  const maxModuleChurn = Math.max(1, ...moduleRows.map((row) => row.churn));

  const topChurnCommits = [...data.commits].sort((a, b) => churnOf(b) - churnOf(a)).slice(0, 18);
  const labelStep = Math.max(1, Math.ceil(data.daily.length / 8));

  return (
    <section className="space-y-5 pb-10">
      <div className="overflow-hidden rounded-[30px] border border-black/10 bg-[radial-gradient(circle_at_14%_0%,rgba(13,148,255,0.2),rgba(245,245,247,0.96)_44%),linear-gradient(140deg,rgba(255,255,255,0.96),rgba(243,247,252,0.92))] p-5 shadow-[0_22px_46px_rgba(17,24,39,0.1)] dark:border-white/15 dark:bg-[radial-gradient(circle_at_15%_0%,rgba(58,152,255,0.26),rgba(11,13,19,0.95)_48%),linear-gradient(140deg,rgba(17,22,35,0.95),rgba(13,17,28,0.92))]">
        <p className="text-[12px] tracking-[0.12em] text-black/52 uppercase dark:text-white/52">Git Pulse</p>
        <h1 className="mt-2 text-[31px] leading-[1.08] font-semibold tracking-[-0.03em] text-black/92 dark:text-white/94">
          新增 / 删除 代码流
        </h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-black/66 dark:text-white/66">
          最近 {data.sinceDays} 天，按真实 commit 的 <code>git numstat</code> 聚合。
        </p>
        <p className="mt-1 text-[12px] text-black/48 dark:text-white/48">生成时间：{new Date(data.generatedAtIso).toLocaleString("zh-CN")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-2xl border border-black/10 bg-white/86 p-4 dark:border-white/15 dark:bg-white/6">
          <p className="text-[12px] text-black/50 dark:text-white/52">提交数</p>
          <p className="mt-1 text-[26px] leading-none font-semibold tracking-[-0.02em] text-black/90 dark:text-white/94">
            {formatNumber(data.totals.commits)}
          </p>
        </article>
        <article className="rounded-2xl border border-black/10 bg-white/86 p-4 dark:border-white/15 dark:bg-white/6">
          <p className="text-[12px] text-black/50 dark:text-white/52">影响文件</p>
          <p className="mt-1 text-[26px] leading-none font-semibold tracking-[-0.02em] text-black/90 dark:text-white/94">
            {formatNumber(data.totals.files)}
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-500/30 bg-emerald-400/9 p-4 dark:border-emerald-300/35 dark:bg-emerald-400/14">
          <p className="text-[12px] text-emerald-800/74 dark:text-emerald-100/74">新增行数</p>
          <p className="mt-1 text-[24px] leading-none font-semibold tracking-[-0.02em] text-emerald-800 dark:text-emerald-100">
            +{formatNumber(data.totals.insertions)}
          </p>
        </article>
        <article className="rounded-2xl border border-rose-500/30 bg-rose-400/9 p-4 dark:border-rose-300/35 dark:bg-rose-400/14">
          <p className="text-[12px] text-rose-800/76 dark:text-rose-100/78">删除行数</p>
          <p className="mt-1 text-[24px] leading-none font-semibold tracking-[-0.02em] text-rose-800 dark:text-rose-100">
            -{formatNumber(data.totals.deletions)}
          </p>
        </article>
      </div>

      <article className="rounded-3xl border border-black/10 bg-white/86 p-4 shadow-[0_8px_22px_rgba(17,24,39,0.08)] dark:border-white/15 dark:bg-white/6">
        <div className="flex items-end justify-between">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-black/88 dark:text-white/92">日趋势（上增下删）</h2>
          <span
            className={`text-[12px] font-medium ${data.totals.net >= 0 ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"}`}
          >
            净变化 {formatSigned(data.totals.net)}
          </span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid h-[192px] gap-1 rounded-2xl border border-black/8 bg-black/[0.03] px-2 py-3 dark:border-white/12 dark:bg-white/[0.03]" style={dailyColumns}>
              {data.daily.map((item) => (
                <div key={item.day} className="flex flex-col justify-between">
                  <div className="flex h-1/2 items-end">
                    <div className="w-full rounded-t-[4px] bg-emerald-500/78 dark:bg-emerald-400/82" style={{ height: tinyBarHeight(item.insertions, maxDailyChurn) }} />
                  </div>
                  <div className="flex h-1/2 items-start">
                    <div className="w-full rounded-b-[4px] bg-rose-500/76 dark:bg-rose-400/82" style={{ height: tinyBarHeight(item.deletions, maxDailyChurn) }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 grid gap-1 text-center text-[10px] text-black/48 dark:text-white/48" style={dailyColumns}>
              {data.daily.map((item, index) => (
                <span key={item.day} className={index % labelStep === 0 || index === data.daily.length - 1 ? "opacity-100" : "opacity-0"}>
                  {shortDay(item.day)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-3xl border border-black/10 bg-white/86 p-4 shadow-[0_8px_22px_rgba(17,24,39,0.08)] dark:border-white/15 dark:bg-white/6">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-black/88 dark:text-white/92">模块贡献（按变更行）</h2>
        <div className="mt-3 space-y-3">
          {moduleRows.map((row) => (
            <div key={row.bucket}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-black/72 dark:text-white/78">{MODULE_LABEL[row.bucket]}</span>
                <span className="text-black/54 dark:text-white/56">
                  {formatNumber(row.commits)} commits · {formatSigned(row.net)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-black/8 dark:bg-white/12">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (row.churn / maxModuleChurn) * 100)}%`,
                    background: MODULE_COLOR[row.bucket],
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-black/46 dark:text-white/46">{moduleScopeHint(row.bucket)}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-3xl border border-black/10 bg-white/86 p-4 shadow-[0_8px_22px_rgba(17,24,39,0.08)] dark:border-white/15 dark:bg-white/6">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-black/88 dark:text-white/92">提交热区（周 x 时）</h2>
        <p className="mt-1 text-[12px] text-black/52 dark:text-white/56">颜色越深，代表该时段提交数越密集。</p>
        <div className="mt-3 space-y-2">
          {data.heatmap.map((row, weekday) => (
            <div key={WEEKDAY_LABELS[weekday]} className="flex items-center gap-2">
              <span className="w-4 text-right text-[10px] text-black/48 dark:text-white/52">{WEEKDAY_LABELS[weekday]}</span>
              <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                {row.map((value, hour) => {
                  const alpha = value <= 0 ? 0.08 : 0.16 + (value / maxHeat) * 0.74;
                  return (
                    <div
                      key={`${weekday}-${hour}`}
                      className="h-[9px] rounded-[3px] border border-black/6 dark:border-white/10"
                      title={`周${WEEKDAY_LABELS[weekday]} ${hour}:00 · ${value} commits`}
                      style={{ backgroundColor: `rgba(10,132,255,${alpha})` }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-3xl border border-black/10 bg-white/86 p-4 shadow-[0_8px_22px_rgba(17,24,39,0.08)] dark:border-white/15 dark:bg-white/6">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-black/88 dark:text-white/92">高波动提交 Top 18</h2>
        <div className="mt-3 space-y-2">
          {topChurnCommits.map((commit) => (
            <div key={commit.hash} className="rounded-2xl border border-black/8 bg-black/[0.02] p-3 dark:border-white/12 dark:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] leading-[1.45] text-black/76 dark:text-white/78">{shortSubject(commit.subject)}</p>
                <span className="rounded-full border border-black/10 px-2 py-[2px] text-[10px] text-black/55 dark:border-white/16 dark:text-white/58">
                  {commit.hash.slice(0, 7)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-black/54 dark:text-white/58">
                  {commit.dayKey} · {MODULE_LABEL[commit.module]}
                </span>
                <span className="font-medium text-black/68 dark:text-white/74">
                  <span className="text-emerald-700 dark:text-emerald-300">+{formatNumber(commit.insertions)}</span>
                  {" / "}
                  <span className="text-rose-700 dark:text-rose-300">-{formatNumber(commit.deletions)}</span>
                </span>
              </div>
              <div className="mt-2 h-[5px] rounded-full bg-black/8 dark:bg-white/12">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(52,199,89,0.92),rgba(255,69,58,0.92))]"
                  style={{ width: `${Math.max(3, (churnOf(commit) / maxCommitChurn) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
