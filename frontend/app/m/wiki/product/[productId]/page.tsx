import Image from "next/image";
import Link from "next/link";
import AddToBagButton from "@/components/mobile/AddToBagButton";
import { fetchMobileWikiProductDetail, resolveImageUrl } from "@/lib/api";
import { formatRuntimeError } from "@/lib/error";

function fmtTime(value?: string | null): string {
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

export default async function MobileWikiProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }> | { productId: string };
}) {
  const { productId } = await Promise.resolve(params);

  let data: Awaited<ReturnType<typeof fetchMobileWikiProductDetail>> | null = null;
  let loadError: string | null = null;
  try {
    data = await fetchMobileWikiProductDetail(productId);
  } catch (err) {
    loadError = formatRuntimeError(err);
  }

  if (!data) {
    return (
      <section className="pb-24">
        <article className="rounded-[24px] border border-[#ffb39e]/55 bg-[#fff7f3] px-4 py-4 text-[#7a2d21]">
          <h1 className="text-[22px] font-semibold">产品百科加载失败</h1>
          <p className="mt-2 text-[13px] leading-[1.55]">未做降级，已展示真实错误：</p>
          <p className="mt-2 rounded-xl border border-[#f6c6bc] bg-white/85 px-3 py-2 text-[12px] leading-[1.55]">
            {loadError || "unknown"}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/m/wiki"
              className="inline-flex h-9 items-center rounded-full border border-black/15 bg-white px-4 text-[12px] font-semibold text-black/75"
            >
              返回百科
            </Link>
            <Link
              href="/m/choose"
              className="inline-flex h-9 items-center rounded-full border border-black/15 bg-white px-4 text-[12px] font-semibold text-black/75"
            >
              去智能推荐
            </Link>
          </div>
        </article>
      </section>
    );
  }

  const item = data.item;
  const product = item.product;

  return (
    <section className="pb-28">
      <Link
        href="/m/wiki"
        className="inline-flex h-9 items-center rounded-full border border-black/15 bg-white px-4 text-[12px] font-semibold text-black/75 active:bg-black/[0.03]"
      >
        返回百科
      </Link>

      <article className="mt-3 overflow-hidden rounded-[26px] border border-black/10 bg-white">
        <div className="relative aspect-[4/3] bg-[#f4f5f9]">
          <Image
            src={resolveImageUrl(product)}
            alt={product.name || product.id}
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black/[0.05] px-3 py-1 text-[11px] text-black/64">{item.category_label}</span>
            {item.target_type_title ? (
              <span className="rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-3 py-1 text-[11px] text-[#244f9e]">
                {item.target_type_title}
              </span>
            ) : null}
            {item.is_featured ? (
              <span className="rounded-full border border-[#1f7a45]/35 bg-[#eaf8ef] px-3 py-1 text-[11px] text-[#116a3f]">
                当前主推
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 text-[24px] leading-[1.24] font-semibold tracking-[-0.02em] text-black/90">
            {product.name || "未命名产品"}
          </h1>
          <p className="mt-1 text-[14px] text-black/58">{product.brand || "品牌未识别"}</p>
          <p className="mt-3 text-[14px] leading-[1.55] text-black/68">
            {product.one_sentence || "暂无一句话摘要。"}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] text-black/56">
            <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div>映射状态</div>
              <div className="mt-1 font-medium text-black/78">{item.mapping_ready ? "已完成" : "未完成"}</div>
            </div>
            <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div>主类置信度</div>
              <div className="mt-1 font-medium text-black/78">{typeof item.primary_confidence === "number" ? `${item.primary_confidence}%` : "-"}</div>
            </div>
            <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div>创建时间</div>
              <div className="mt-1 font-medium text-black/78">{fmtTime(product.created_at)}</div>
            </div>
            <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div>产品 ID</div>
              <div className="mt-1 line-clamp-1 font-medium text-black/78">{product.id}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AddToBagButton productId={product.id} />
            <Link
              href={`/product/${encodeURIComponent(product.id)}`}
              className="inline-flex h-10 items-center rounded-full border border-black/15 bg-white px-4 text-[12px] font-semibold text-black/75 active:bg-black/[0.03]"
            >
              打开完整产品页
            </Link>
          </div>
        </div>
      </article>

      <article className="mt-4 rounded-[24px] border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[18px] font-semibold text-black/88">成分列表</h2>
        {item.doc.ingredients.length === 0 ? (
          <p className="mt-2 text-[13px] text-black/58">无可用成分数据。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {item.doc.ingredients.map((ing, idx) => (
              <li key={`${ing.name}-${idx}`} className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
                <div className="text-[13px] font-semibold text-black/84">{ing.name || "未命名成分"}</div>
                <div className="mt-1 text-[12px] text-black/56">
                  类型：{ing.type || "-"} · 风险：{ing.risk || "-"}
                </div>
                {ing.functions?.length ? (
                  <div className="mt-1 text-[12px] text-black/56">功能：{ing.functions.join(" / ")}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
