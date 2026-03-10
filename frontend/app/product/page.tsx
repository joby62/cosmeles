import { ReactNode } from "react";
import {
  fetchAIMetricsSummary,
  fetchAllProducts,
  fetchProductAnalysisIndex,
  fetchProductFeaturedSlots,
  fetchProductRouteMappingIndex,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";
import ProductIngestWorkbench from "@/components/ProductIngestWorkbench";
import ProductDedupManager from "@/components/ProductDedupManager";
import ProductCleanupWorkbench from "@/components/ProductCleanupWorkbench";
import IngredientLibraryGenerator from "@/components/IngredientLibraryGenerator";
import IngredientCleanupWorkbench from "@/components/IngredientCleanupWorkbench";
import ProductRouteMappingGenerator from "@/components/ProductRouteMappingGenerator";
import ProductAnalysisGenerator from "@/components/ProductAnalysisGenerator";
import ProductCatalogManager from "@/components/ProductCatalogManager";

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

export default async function ProductManagementPage() {
  const products = await fetchAllProducts();
  const loadWarnings: Array<{ source: string; message: string }> = [];
  const aiMetrics = await loadWithWarning(
    fetchAIMetricsSummary({ sinceHours: 24 * 7 }),
    "ai_metrics",
    loadWarnings,
    {
      capability: null,
      since_hours: 24 * 7,
      window_start: "",
      total_jobs: 0,
      succeeded_jobs: 0,
      failed_jobs: 0,
      running_jobs: 0,
      queued_jobs: 0,
      success_rate: 0,
      timeout_failures: 0,
      timeout_rate: 0,
      total_runs: 0,
      succeeded_runs: 0,
      failed_runs: 0,
      avg_latency_ms: null,
      p95_latency_ms: null,
      total_estimated_cost: 0,
      avg_task_cost: null,
      priced_runs: 0,
      cost_coverage_rate: 0,
    },
  );
  const routeMappings = await loadWithWarning(
    fetchProductRouteMappingIndex(),
    "route_mapping_index",
    loadWarnings,
    { status: "error", category: null, total: 0, items: [] },
  );
  const analysisIndex = await loadWithWarning(
    fetchProductAnalysisIndex(),
    "product_analysis_index",
    loadWarnings,
    { status: "error", category: null, total: 0, items: [] },
  );
  const featuredSlots = await loadWithWarning(
    fetchProductFeaturedSlots(),
    "featured_slots",
    loadWarnings,
    { status: "error", category: null, total: 0, items: [] },
  );

  const categoryCounts = new Map<string, number>();
  for (const item of products) {
    const key = item.category || "unknown";
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }

  const categoryStats = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] px-6 py-12">
      {loadWarnings.length > 0 ? (
        <section className="mb-6 rounded-[20px] border border-[#f3c77b]/55 bg-[#fff7e9] px-5 py-4 text-[#855400]">
          <div className="text-[14px] font-semibold">过渡模式：部分能力未就绪，已启用兼容回退</div>
          <ul className="mt-2 space-y-1 text-[12px] leading-[1.55]">
            {loadWarnings.map((item, idx) => (
              <li key={`${idx}-${item.source}`}>
                • {item.source}：{item.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-[34px] border border-black/10 bg-gradient-to-br from-[#f7f9ff] via-white to-[#f2f6f1] px-8 py-9">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#2f7bf6]/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-[#00a86b]/10 blur-2xl" />
        <div className="relative">
          <div className="text-[12px] font-semibold tracking-[0.12em] text-black/46">PRODUCT MANAGEMENT</div>
          <h1 className="mt-2 text-[44px] font-semibold tracking-[-0.03em] text-black/90">产品管理</h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-[1.6] text-black/62">
            统一收口到一个页面，但不再平铺堆叠；按“产品生产流水线 / 产品展示与清理 / 成分可视化与清理”三组编排，减少上下文切换。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
              总产品数：{products.length}
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              产品生产流水线
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              产品展示与清理
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              成分可视化与清理
            </span>
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

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <AnchorChip href="#product-pipeline" label="流水线" />
            <AnchorChip href="#product-governance" label="产品治理" />
            <AnchorChip href="#ingredient-governance" label="成分治理" />
          </div>
        </div>
      </section>

      <ManagementCluster
        id="product-pipeline"
        eyebrow="PRODUCT FLOWLINE"
        title="产品生产流水线"
        description="先产出，再治理。上传、同品归并、成分分析、类型映射和产品增强分析都放在同一条生产链里。"
      >
        <ProductIngestWorkbench />
        <ProductDedupManager initialProducts={products} />
        <IngredientLibraryGenerator initialProducts={products} showCleanupConsole={false} />
        <ProductRouteMappingGenerator initialProducts={products} />
        <ProductAnalysisGenerator initialProducts={products} initialAnalysisIndex={analysisIndex.items} />
      </ManagementCluster>

      <ManagementCluster
        id="product-governance"
        eyebrow="PRODUCT GOVERNANCE"
        title="产品展示与清理"
        description="主推配置、展示筛选和清理维护放在同一区块，先看展示，再决定修或删。"
      >
        <ProductCatalogManager
          initialProducts={products}
          initialRouteMappings={routeMappings.items}
          initialFeaturedSlots={featuredSlots.items}
        />
        <ProductCleanupWorkbench initialProducts={products} />
      </ManagementCluster>

      <ManagementCluster
        id="ingredient-governance"
        eyebrow="INGREDIENT GOVERNANCE"
        title="成分可视化与清理"
        description="把成分分布洞察和批量清理放在一起，先看结构，再做删除。"
      >
        <IngredientCleanupWorkbench initialProducts={products} initialRouteMappings={routeMappings.items} />
      </ManagementCluster>
    </main>
  );
}

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function loadWithWarning<T>(
  promise: Promise<T>,
  source: string,
  collector: Array<{ source: string; message: string }>,
  fallback: T,
): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    collector.push({ source, message: formatErr(err) });
    return fallback;
  }
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

function AnchorChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/72 hover:bg-black/[0.03]"
    >
      {label}
    </a>
  );
}

function ManagementCluster({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <div className="rounded-[28px] border border-black/10 bg-[#f6f8fb] px-6 py-5">
        <div className="text-[11px] font-semibold tracking-[0.12em] text-black/42">{eyebrow}</div>
        <div className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-black/88">{title}</div>
        <p className="mt-2 max-w-[760px] text-[14px] leading-[1.6] text-black/62">{description}</p>
      </div>
      {children}
    </section>
  );
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function num(value?: number | null): string {
  if (typeof value !== "number") return "-";
  return String(Math.round(value));
}
