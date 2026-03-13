import Link from "next/link";
import ProductCard from "@/components/site/ProductCard";
import TrustStrip from "@/components/site/TrustStrip";
import { fetchAllProducts, fetchProductAnalysisIndex, type Product } from "@/lib/api";
import { sortProductsByCommerceReadiness } from "@/lib/productCommerce";
import { analysisCardProofSummary } from "@/lib/productEvidence";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";
import { categoryHref, getCategories, getLearnTopics, getShopConcerns, getTrustItems, type CategoryKey } from "@/lib/site";
import { getStorefrontTrustCopy } from "@/lib/storefrontTrust";

function pickHighlights(products: Product[], categories: ReturnType<typeof getCategories>) {
  const sorted = sortProductsByCommerceReadiness(products);
  const byCategory = new Map<CategoryKey, Product>();

  for (const item of sorted) {
    const key = String(item.category || "").trim().toLowerCase() as CategoryKey;
    if (!byCategory.has(key)) {
      byCategory.set(key, item);
    }
  }

  return categories.map((category) => byCategory.get(category.key)).filter((item): item is Product => Boolean(item));
}

export default async function HomePage() {
  const { locale } = await getRequestSitePreferences();
  const categories = getCategories(locale);
  const concerns = getShopConcerns(locale);
  const trustItems = getTrustItems(locale);
  const learnTopics = getLearnTopics(locale);
  const { LAUNCH_STATUS_POINTS: launchStatusPoints } = getStorefrontTrustCopy(locale);

  let products: Product[] = [];
  let analysisItems: Awaited<ReturnType<typeof fetchProductAnalysisIndex>> = [];
  let loadError: string | null = null;

  try {
    [products, analysisItems] = await Promise.all([fetchAllProducts(), fetchProductAnalysisIndex().catch(() => [])]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const highlights = pickHighlights(products, categories).slice(0, 4);
  const analysisById = new Map(analysisItems.map((item) => [item.product_id, item]));
  const counts = new Map<CategoryKey, number>();
  for (const category of categories) counts.set(category.key, 0);
  for (const item of products) {
    const key = String(item.category || "").trim().toLowerCase() as CategoryKey;
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const copy =
    locale === "zh"
      ? {
          eyebrow: "婕选中文站",
          title: "找到真正适合你日常护理节奏的产品。",
          summary: "婕选正在把个护选购重建成一条更清楚的路径：先看是否适合，再做更低负担的比较，最后把决定留在一个更从容的节奏里。",
          statusLabel: "当前站点状态",
          statusSummary: "当前站点已支持发现、测配、对比、探索与保存恢复。价格、库存、支付和最终配送时效仍在逐步接入中。",
          primaryCta: "开始测配",
          secondaryCta: "进入选购",
          concernEyebrow: "按问题进入",
          concernTitle: "先从你最想解决的问题开始。",
          concernLink: "查看全部品类",
          concernChip: "问题",
          currentEditEyebrow: "当前优先商品",
          currentEditTitle: "先看当前信息最完整、最适合开始决策的商品。",
          currentEditLink: "打开选购",
          loadError: "商品加载失败",
          matchEyebrow: "测配",
          matchTitle: "还不确定该从哪里开始？",
          matchSummary: "回答几个简短问题，让婕选先帮你把当前更适合的路线收出来。",
          matchLink: "开始测配",
          compareEyebrow: "对比",
          compareTitle: "把差异放到同一屏里看清楚。",
          compareSummary: "在决定换不换之前，把成分结构、使用场景和适配信号并排看清楚。",
          compareLink: "打开对比",
          learnEyebrow: "探索",
          learnTitle: "先理解，再决定。",
          supportEyebrow: "支持",
          supportTitle: "配送要清楚，退货要直白，基础信息不要埋起来。",
          supportSummary: "在支付能力接入之前，配送、退货、FAQ、联系路径和政策边界都应该提前可见。",
          supportLinks: ["支持中心", "配送说明", "退货规则", "常见问题", "联系婕选"],
          mappedCount: (count: number) => `当前已映射 ${count} 个商品`,
          open: "进入",
        }
      : {
          eyebrow: "Jeslect US launch",
          title: "Find products that fit your routine.",
          summary: "Jeslect is rebuilding the shopping journey around clear product fit, lower-friction comparison, and calmer routine decisions for hair, body, and skin.",
          statusLabel: "US launch status",
          statusSummary: "The current storefront is live for discovery and fit. Price, stock, checkout, and final delivery ETA are not published yet.",
          primaryCta: "Find my match",
          secondaryCta: "Shop the current edit",
          concernEyebrow: "Shop by concern",
          concernTitle: "Start with the problem you want to solve.",
          concernLink: "View all categories",
          concernChip: "Concern",
          currentEditEyebrow: "Current product edit",
          currentEditTitle: "Start with the clearest category picks we have live now.",
          currentEditLink: "Open shop",
          loadError: "Product loading failed",
          matchEyebrow: "Match",
          matchTitle: "Not sure where to start?",
          matchSummary: "Answer a few quick questions and let Jeslect rebuild the routine around your current needs.",
          matchLink: "Open match",
          compareEyebrow: "Compare",
          compareTitle: "See differences side by side.",
          compareSummary: "Compare ingredient profile, use case, and fit signals before you commit to a product change.",
          compareLink: "Open compare",
          learnEyebrow: "Learn",
          learnTitle: "Learn before you buy.",
          supportEyebrow: "Support",
          supportTitle: "Simple shipping. Clear returns. No buried basics.",
          supportSummary: "US launch pages need shipping, returns, FAQ, contact, and policy scope visible before checkout ever enters the picture.",
          supportLinks: ["Support hub", "Shipping policy", "Returns policy", "Shopping FAQ", "Contact Jeslect"],
          mappedCount: (count: number) => `${count} products currently mapped`,
          open: "Open",
        };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="overflow-hidden rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
              {copy.eyebrow}
            </div>
            <h1 className="site-display mt-5 text-[44px] leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[56px] lg:text-[72px]">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-slate-600">
              {copy.summary}
            </p>
            <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50/70 px-4 py-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-800">{copy.statusLabel}</p>
              <p className="mt-2 text-[14px] leading-6 text-slate-700">{copy.statusSummary}</p>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/match"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)]"
              >
                {copy.primaryCta}
              </Link>
              <Link
                href="/shop"
                className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700"
              >
                {copy.secondaryCta}
              </Link>
            </div>
            <TrustStrip items={trustItems} className="mt-6" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((category) => (
              <Link
                key={category.key}
                href={categoryHref(category.key)}
                className="rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fc_100%)] p-5 transition hover:-translate-y-[1px] hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{category.eyebrow}</div>
                <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-slate-950">{category.label}</h2>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">{category.description}</p>
                <div className="mt-5 flex items-center justify-between text-[13px] font-medium text-slate-700">
                  <span>{copy.mappedCount(counts.get(category.key) || 0)}</span>
                  <span>{copy.open}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.concernEyebrow}</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.concernTitle}</h2>
          </div>
          <Link href="/shop" className="text-[14px] font-semibold text-sky-700">
            {copy.concernLink}
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {concerns.map((concern) => (
            <Link
              key={concern.key}
              href={concern.href}
              className="rounded-[28px] border border-black/8 bg-white/88 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition hover:-translate-y-[1px]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">{copy.concernChip}</div>
              <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{concern.label}</h3>
              <p className="mt-3 text-[14px] leading-6 text-slate-600">{concern.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.currentEditEyebrow}</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.currentEditTitle}</h2>
          </div>
          <Link href="/shop" className="text-[14px] font-semibold text-sky-700">
            {copy.currentEditLink}
          </Link>
        </div>

        {loadError ? (
          <article className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-[14px] leading-6 text-rose-700">
            {copy.loadError}: {loadError}
          </article>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {highlights.map((product, index) => {
              const analysis = analysisById.get(product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 2}
                  headline={analysis?.headline || product.one_sentence}
                  routeTitle={analysis?.route_title}
                  fitConfidence={analysis?.confidence}
                  fitVerdict={analysis?.subtype_fit_verdict || null}
                  needsReview={analysis?.needs_review || false}
                  proofSummary={analysisCardProofSummary(analysis)}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-3">
        <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">{copy.matchEyebrow}</p>
          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{copy.matchTitle}</h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">{copy.matchSummary}</p>
          <Link href="/match" className="mt-6 inline-flex text-[14px] font-semibold text-sky-700">
            {copy.matchLink}
          </Link>
        </article>

        <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">{copy.compareEyebrow}</p>
          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{copy.compareTitle}</h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">{copy.compareSummary}</p>
          <Link href="/compare" className="mt-6 inline-flex text-[14px] font-semibold text-sky-700">
            {copy.compareLink}
          </Link>
        </article>

        <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">{copy.learnEyebrow}</p>
          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{copy.learnTitle}</h2>
          <div className="mt-4 space-y-3">
            {learnTopics.map((topic) => (
              <Link key={topic.title} href={topic.href} className="block rounded-[22px] border border-black/8 bg-slate-50 px-4 py-4">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-900">{topic.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-slate-600">{topic.summary}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-12 rounded-[36px] border border-black/8 bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)] px-6 py-8 shadow-[0_22px_56px_rgba(15,23,42,0.07)]">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">{copy.supportEyebrow}</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-slate-950">{copy.supportTitle}</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">{copy.supportSummary}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/support" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              {copy.supportLinks[0]}
            </Link>
            <Link href="/support/shipping" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              {copy.supportLinks[1]}
            </Link>
            <Link href="/support/returns" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              {copy.supportLinks[2]}
            </Link>
            <Link href="/support/faq" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              {copy.supportLinks[3]}
            </Link>
            <Link href="/support/contact" className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] font-medium text-slate-700">
              {copy.supportLinks[4]}
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {launchStatusPoints.map((item) => (
            <div key={item} className="rounded-[24px] border border-black/8 bg-white px-4 py-4 text-[14px] leading-6 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
