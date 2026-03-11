import Link from "next/link";
import { ReactNode } from "react";
import { type AIMetricsSummary } from "@/lib/api";
import {
  categoryLabel,
  num,
  pct,
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
  children,
}: {
  activeSection: ProductManagementSectionKey;
  productsCount: number;
  categoryStats: Array<[string, number]>;
  aiMetrics: AIMetricsSummary;
  children: ReactNode;
}) {
  const current = getProductManagementSection(activeSection);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] px-6 py-12">
      <section className="relative overflow-hidden rounded-[34px] border border-black/10 bg-gradient-to-br from-[#f7f9ff] via-white to-[#f2f6f1] px-8 py-9">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#2f7bf6]/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-[#00a86b]/10 blur-2xl" />
        <div className="relative">
          <div className="text-[12px] font-semibold tracking-[0.12em] text-black/46">PRODUCT MANAGEMENT</div>
          <h1 className="mt-2 text-[44px] font-semibold tracking-[-0.03em] text-black/90">{current.titleZh}</h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-[1.6] text-black/62">{current.summaryZh}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
              总产品数：{productsCount}
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
        </div>
      </section>

      {children}
    </main>
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
