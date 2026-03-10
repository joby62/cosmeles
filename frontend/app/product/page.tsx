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
            一个页面串行完成：上传解析、重合度去重、成分分析、类型映射、成分库生成、产品增强分析与主推配置，不再分散到独立上传页或桌面对比页。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
              总产品数：{products.length}
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              Stage A 上传解析
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              Stage B 去重
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              Stage C 成分分析
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              Stage D 类型映射
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              Stage E 成分库生成
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
              Stage F 产品增强分析
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
        </div>
      </section>

      <ProductIngestWorkbench />
      <ProductDedupManager initialProducts={products} />
      <IngredientLibraryGenerator initialProducts={products} showCleanupConsole={false} />
      <ProductRouteMappingGenerator initialProducts={products} />
      <ProductAnalysisGenerator initialProducts={products} initialAnalysisIndex={analysisIndex.items} />
      <ProductCatalogManager
        initialProducts={products}
        initialRouteMappings={routeMappings.items}
        initialFeaturedSlots={featuredSlots.items}
      />
      <ProductCleanupWorkbench initialProducts={products} />
      <IngredientCleanupWorkbench initialProducts={products} initialRouteMappings={routeMappings.items} />
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

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function num(value?: number | null): string {
  if (typeof value !== "number") return "-";
  return String(Math.round(value));
}
