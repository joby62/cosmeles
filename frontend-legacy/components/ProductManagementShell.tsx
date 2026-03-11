import Link from "next/link";
import { ReactNode } from "react";
import { type AIMetricsSummary } from "@/lib/api";
import {
  categoryLabel,
  num,
  pct,
  type ProductManagementDataError,
} from "@/lib/productManagementData";
import {
  getProductManagementSection,
  PRODUCT_MANAGEMENT_SECTIONS,
  type ProductManagementSectionKey,
} from "@/lib/productManagementNav";

export default function ProductManagementShell({
  activeSection,
  productsCount,
  categoryStats,
  aiMetrics,
  issues,
  children,
  widthMode = "default",
}: {
  activeSection: ProductManagementSectionKey;
  productsCount: number | null;
  categoryStats: Array<[string, number]>;
  aiMetrics: AIMetricsSummary | null;
  issues?: ProductManagementDataError[];
  children: ReactNode;
  widthMode?: "default" | "wide";
}) {
  const current = getProductManagementSection(activeSection);
  const widthClass =
    widthMode === "wide"
      ? "max-w-[1780px] px-6 xl:px-8 2xl:px-10"
      : "max-w-[1180px] px-6 md:px-8";

  return (
    <main className={`mx-auto min-h-screen w-full py-12 ${widthClass}`}>
      <section className="relative overflow-hidden rounded-[34px] border border-black/10 bg-gradient-to-br from-[#f7f9ff] via-white to-[#f2f6f1] px-8 py-9">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#2f7bf6]/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-[#00a86b]/10 blur-2xl" />
        <div className="relative">
          <div className="text-[12px] font-semibold tracking-[0.12em] text-black/46">PRODUCT MANAGEMENT</div>
          <h1 className="mt-2 text-[44px] font-semibold tracking-[-0.03em] text-black/90">{current.titleZh}</h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-[1.6] text-black/62">{current.summaryZh}</p>

          {issues?.length ? (
            <div className="mt-5 rounded-[22px] border border-[#f0b3ab] bg-[#fff4f2] p-4 text-[#7f2b21]">
              <div className="text-[13px] font-semibold">部分数据源加载失败</div>
              <div className="mt-1 text-[12px] leading-[1.55]">按 strict 规则直接暴露真实错误；未拿到的数据区块不会伪造内容。</div>
              <ul className="mt-3 space-y-2 text-[12px] leading-[1.55]">
                {issues.map((item) => (
                  <li key={`${item.stage}:${item.detail}`} className="rounded-2xl border border-[#efc0ba] bg-white px-3 py-2">
                    <div className="font-semibold">stage: {item.stage}</div>
                    <div className="mt-1 whitespace-pre-wrap">{item.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
              总产品数：{typeof productsCount === "number" ? productsCount : "加载失败"}
            </span>
            {PRODUCT_MANAGEMENT_SECTIONS.filter((item) => item.key !== "overview").map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${
                  item.key === activeSection
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/66 hover:bg-black/[0.03]"
                }`}
              >
                {item.titleZh}
              </Link>
            ))}
            {categoryStats.map(([key, count]) => (
              <span key={key} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
                {categoryLabel(key)} · {count}
              </span>
            ))}
          </div>

          {aiMetrics ? (
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <MetricsBadge label="AI成功率(7d)" value={pct(aiMetrics.success_rate)} />
              <MetricsBadge label="AI超时率(7d)" value={pct(aiMetrics.timeout_rate)} />
              <MetricsBadge label="P95时延(ms)" value={num(aiMetrics.p95_latency_ms)} />
              <MetricsBadge
                label="单任务成本(估)"
                value={aiMetrics.avg_task_cost == null ? "-" : aiMetrics.avg_task_cost.toFixed(4)}
                sub={`覆盖率 ${pct(aiMetrics.cost_coverage_rate)}`}
              />
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-[#f0b3ab] bg-white px-4 py-3 text-[12px] text-[#7f2b21]">
              AI 指标未加载成功，顶部只保留真实错误，不做指标兜底。
            </div>
          )}
        </div>
      </section>

      {children}
    </main>
  );
}

export function ProductManagementStageErrorCard({
  title,
  errors,
}: {
  title: string;
  errors: ProductManagementDataError[];
}) {
  return (
    <section className="mt-6 rounded-[28px] border border-[#f0b3ab] bg-[#fff4f2] px-6 py-5 text-[#7f2b21]">
      <div className="text-[12px] font-semibold tracking-[0.12em]">BLOCKED</div>
      <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 text-[13px] leading-[1.6]">当前区块缺少必要数据，已阻断渲染，不做空数据回填。</p>
      <ul className="mt-4 space-y-2 text-[12px] leading-[1.55]">
        {errors.map((item) => (
          <li key={`${item.stage}:${item.detail}`} className="rounded-2xl border border-[#efc0ba] bg-white px-3 py-2">
            <div className="font-semibold">stage: {item.stage}</div>
            <div className="mt-1 whitespace-pre-wrap">{item.detail}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MetricsBadge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-3 py-2.5">
      <div className="text-[11px] text-black/46">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold text-black/82">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-black/44">{sub}</div> : null}
    </div>
  );
}
