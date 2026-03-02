import Link from "next/link";
import Image from "next/image";
import { fetchAIMetricsSummary, fetchAllProducts, resolveImageUrl } from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function ProductGalleryPage() {
  const products = await fetchAllProducts();
  const aiMetrics = await fetchAIMetricsSummary({ sinceHours: 24 * 7 }).catch(() => null);

  const categoryCounts = new Map<string, number>();
  for (const item of products) {
    const key = item.category || "unknown";
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }

  const categoryStats = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] px-6 py-12">
      <section className="relative overflow-hidden rounded-[34px] border border-black/10 bg-gradient-to-br from-[#f7f9ff] via-white to-[#f2f6f1] px-8 py-9">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#2f7bf6]/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-[#00a86b]/10 blur-2xl" />
        <div className="relative">
          <div className="text-[12px] font-semibold tracking-[0.12em] text-black/46">PRODUCT LIBRARY</div>
          <h1 className="mt-2 text-[44px] font-semibold tracking-[-0.03em] text-black/90">产品展示</h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-[1.6] text-black/62">
            这里汇总了你在上传页分析过的全部产品。点击任意卡片可进入可视化详情页，查看摘要、成分、证据与完整 JSON。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
              总产品数：{products.length}
            </span>
            {categoryStats.map(([key, count]) => (
              <span key={key} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
                {categoryLabel(key)} · {count}
              </span>
            ))}
            <Link
              href="/product/dedup"
              className="rounded-full border border-[#f97316]/30 bg-[#fff7ed] px-4 py-1.5 text-[12px] font-semibold text-[#c2410c] transition-colors hover:bg-[#ffedd5]"
            >
              重复检查与删除
            </Link>
            <Link
              href="/upload"
              className="rounded-full border border-black/14 bg-black px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              去上传
            </Link>
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
          ) : null}
        </div>
      </section>

      {products.length === 0 ? (
        <section className="mt-8 rounded-[28px] border border-dashed border-black/16 bg-white px-8 py-14 text-center">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-black/84">还没有可展示的产品</h2>
          <p className="mt-2 text-[14px] text-black/58">先去上传页提交图片，完成分析后这里会自动出现产品卡片。</p>
          <Link
            href="/upload"
            className="mt-5 inline-flex rounded-full border border-black/12 bg-black px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            前往上传
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((item) => (
            <Link
              key={item.id}
              href={`/product/${item.id}`}
              className="group relative overflow-hidden rounded-[26px] border border-black/10 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/16 hover:shadow-[0_18px_38px_rgba(0,0,0,0.08)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/8 bg-[#f6f7fb]">
                <Image
                  src={resolveImageUrl(item)}
                  alt={item.name || item.id}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-medium text-black/64">
                    {categoryLabel(item.category)}
                  </span>
                  <span className="text-[11px] text-black/45">{formatTime(item.created_at)}</span>
                </div>

                <h2 className="mt-2 text-[20px] font-semibold leading-[1.25] tracking-[-0.02em] text-black/88">
                  {item.name || "未命名产品"}
                </h2>
                <div className="mt-1 text-[13px] text-black/56">{item.brand || "品牌未识别"}</div>

                <p
                  className="mt-3 text-[13px] leading-[1.6] text-black/66"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.one_sentence || "暂无一句话摘要，点击进入查看详细信息。"}
                </p>

                {item.tags && item.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 5).map((tag) => (
                      <span key={`${item.id}-${tag}`} className="rounded-full border border-black/10 bg-black/[0.02] px-2 py-0.5 text-[11px] text-black/60">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 text-[11px] text-black/38">ID: {item.id}</div>
              </div>
            </Link>
          ))}
        </section>
      )}
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

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function num(value?: number | null): string {
  if (typeof value !== "number") return "-";
  return String(Math.round(value));
}
