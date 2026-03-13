import Image from "next/image";
import Link from "next/link";
import { type Product, type ProductAnalysisSubtypeFitVerdict, resolveImageUrl } from "@/lib/api";
import { getCategoryMeta } from "@/lib/site";
import AddToBagButton from "@/components/site/AddToBagButton";
import { commerceBadgeLabel, commerceInventoryLabel, commercePackSizeLabel, commercePriceLabel } from "@/lib/productCommerce";
import { analysisCardProofSummary, analysisConfidenceLabel, analysisReviewLabel, analysisVerdictLabel } from "@/lib/productEvidence";

type ProductCardProps = {
  product: Product;
  headline?: string | null;
  routeTitle?: string | null;
  routeSummary?: string | null;
  fitConfidence?: number | null;
  fitVerdict?: ProductAnalysisSubtypeFitVerdict | null;
  needsReview?: boolean;
  proofSummary?: string | null;
  priority?: boolean;
};

export default function ProductCard({
  product,
  headline,
  routeTitle,
  routeSummary,
  fitConfidence,
  fitVerdict,
  needsReview = false,
  proofSummary,
  priority = false,
}: ProductCardProps) {
  const category = getCategoryMeta(product.category);
  const productName = product.name || "未命名商品";
  const productBrand = product.brand || category?.label || "Jeslect";
  const summary = headline || product.one_sentence || product.description || "打开完整画像页查看更多细节。";
  const packSizeLabel = commercePackSizeLabel(product.commerce);
  const statusLabel = commerceBadgeLabel(product.commerce);
  const priceLabel = commercePriceLabel(product.commerce);
  const inventoryLabel = commerceInventoryLabel(product.commerce);
  const confidenceLabel = analysisConfidenceLabel(fitConfidence);
  const verdictLabel = analysisVerdictLabel(fitVerdict);
  const reviewLabel = analysisReviewLabel(needsReview);
  const proofText = proofSummary || analysisCardProofSummary(
    fitConfidence || fitVerdict || needsReview
      ? {
          product_id: product.id,
          category: product.category,
          route_key: "",
          route_title: routeTitle || "",
          headline: headline || "",
          subtype_fit_verdict: fitVerdict || null,
          confidence: typeof fitConfidence === "number" ? fitConfidence : 0,
          needs_review: needsReview,
        }
      : null,
  );

  return (
    <article className="group overflow-hidden rounded-[28px] border border-black/8 bg-white/92 shadow-[0_20px_46px_rgba(15,23,42,0.07)]">
      <Link href={`/product/${encodeURIComponent(product.id)}`} className="block">
        <div className="relative aspect-[1/1.1] overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)]">
          <Image
            src={resolveImageUrl(product)}
            alt={productName}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        </div>
      </Link>

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {category ? (
            <span className="inline-flex rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
              {category.label}
            </span>
          ) : null}
          {routeTitle ? (
            <span className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
              {routeTitle}
            </span>
          ) : null}
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
            {statusLabel}
          </span>
          {packSizeLabel ? (
            <span className="inline-flex rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
              {packSizeLabel}
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">{productBrand}</p>
        <h3 className="mt-2 text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] text-slate-950">{productName}</h3>
        <p className="mt-3 line-clamp-3 text-[14px] leading-6 text-slate-600">{summary}</p>
        {routeSummary ? <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-slate-500">{routeSummary}</p> : null}
        {confidenceLabel || verdictLabel || reviewLabel || proofText ? (
          <div className="mt-4 rounded-[22px] border border-black/8 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {confidenceLabel ? (
                <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                  {confidenceLabel}
                </span>
              ) : null}
              {verdictLabel ? (
                <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                  {verdictLabel}
                </span>
              ) : null}
              {reviewLabel ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                  {reviewLabel}
                </span>
              ) : null}
            </div>
            {proofText ? <p className="mt-3 text-[13px] leading-6 text-slate-600">{proofText}</p> : null}
          </div>
        ) : null}
        {priceLabel || inventoryLabel ? (
          <div className="mt-4 rounded-[22px] border border-black/8 bg-slate-50 px-4 py-3">
            {priceLabel ? <div className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">{priceLabel}</div> : null}
            {inventoryLabel ? <div className="mt-1 text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">{inventoryLabel}</div> : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={`/product/${encodeURIComponent(product.id)}`}
            className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            查看详情
          </Link>
          <AddToBagButton productId={product.id} compact />
        </div>
      </div>
    </article>
  );
}
