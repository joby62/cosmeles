import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchAllProducts,
  fetchProductRouteMappingIndex,
  resolveImageUrl,
  type Product,
  type ProductRouteMappingIndexItem,
} from "@/lib/api";
import { CATEGORY_CONFIG, isCategoryKey } from "@/lib/catalog";
import { formatRuntimeError } from "@/lib/error";
import { describeMobileRouteFocus } from "@/lib/mobile/routeCopy";

type Params = { category: string };
type Search = Record<string, string | string[] | undefined>;

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const { category: rawCategory } = await Promise.resolve(params);
  const search = (await Promise.resolve(searchParams)) || {};

  if (!isCategoryKey(rawCategory)) {
    notFound();
  }

  const category = rawCategory;
  const config = CATEGORY_CONFIG[category];
  const focusKey = queryValue(search.focus);
  const selectedRoute = config.desktopRoutes.find((item) => item.key === focusKey) || null;

  let products: Product[] = [];
  let productError: string | null = null;
  try {
    products = await fetchAllProducts();
  } catch (err) {
    productError = formatRuntimeError(err);
  }

  let routeMappings: ProductRouteMappingIndexItem[] = [];
  let routeMappingError: string | null = null;
  try {
    const response = await fetchProductRouteMappingIndex({ category });
    routeMappings = response.items;
  } catch (err) {
    routeMappingError = formatRuntimeError(err);
  }

  if (productError) {
    return (
      <main className="min-h-screen px-6 pb-16 pt-14">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#ff9b8f]/55 bg-[#fff1ef] p-6 text-[#8e2e22]">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#7b261d]">{config.zh} 暂时不可用</h1>
          <p className="mt-3 text-[14px] leading-[1.6]">产品列表加载失败，已保留真实错误供排查。</p>
          <p className="mt-2 rounded-2xl border border-[#f2b0a8]/80 bg-[#fff8f7] px-3 py-2 text-[13px] leading-[1.55]">
            真实错误：{productError}
          </p>
        </div>
      </main>
    );
  }

  const categoryProducts = products.filter((item) => item.category === category);
  const mappingByProductId = new Map(routeMappings.map((item) => [item.product_id, item]));
  const routeCounts = new Map(config.desktopRoutes.map((item) => [item.key, 0]));
  for (const item of routeMappings) {
    if (!routeCounts.has(item.primary_route_key)) continue;
    routeCounts.set(item.primary_route_key, (routeCounts.get(item.primary_route_key) || 0) + 1);
  }

  if (selectedRoute && routeMappingError) {
    return (
      <main className="min-h-screen px-6 pb-16 pt-14">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#ff9b8f]/55 bg-[#fff1ef] p-6 text-[#8e2e22]">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#7b261d]">{config.zh} 分类栏暂时不可用</h1>
          <p className="mt-3 text-[14px] leading-[1.6]">
            当前请求按矩阵路线筛选 `{selectedRoute.title}`，但 route mapping 数据加载失败，无法伪造分类结果。
          </p>
          <p className="mt-2 rounded-2xl border border-[#f2b0a8]/80 bg-[#fff8f7] px-3 py-2 text-[13px] leading-[1.55]">
            真实错误：{routeMappingError}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href={`/c/${category}`} className="inline-flex h-10 items-center justify-center rounded-full bg-black px-4 text-[14px] font-semibold text-white">
              查看全部{config.zh}
            </Link>
            <Link href="/" className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-4 text-[14px] font-semibold text-black/78">
              返回首页
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const visibleProducts = selectedRoute
    ? categoryProducts.filter((item) => mappingByProductId.get(item.id)?.primary_route_key === selectedRoute.key)
    : categoryProducts;
  const mappedCount = categoryProducts.filter((item) => mappingByProductId.has(item.id)).length;

  return (
    <main className="min-h-screen px-6 pb-16 pt-14">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[32px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f3f7f2] p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">{config.zh}</span>
            <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
              矩阵路线 {config.desktopRoutes.length} 条
            </span>
            <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
              已映射 {mappedCount}/{categoryProducts.length}
            </span>
          </div>

          <h1 className="mt-4 text-[40px] font-semibold tracking-[-0.03em] text-black/90">{config.zh}</h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-[1.6] text-black/64">{config.tagline}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {config.bullets.map((item) => (
              <span key={item} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
                {item}
              </span>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-black/10 bg-white/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold tracking-[0.08em] text-black/48">MATRIX CATEGORY BAR</div>
                <p className="mt-1 text-[13px] leading-[1.55] text-black/60">
                  desktop 分类栏已对齐 mobile 决策矩阵。点击路线可按 `primary_route` 过滤产品。
                </p>
              </div>
              {routeMappingError ? <div className="text-[12px] text-[#b42318]">route mapping 加载失败：{routeMappingError}</div> : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/c/${category}`}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${selectedRoute ? "border-black/10 bg-white text-black/68" : "border-black bg-black text-white"}`}
              >
                全部 · {categoryProducts.length}
              </Link>
              {config.desktopRoutes.map((item) => (
                <Link
                  key={item.key}
                  href={`/c/${category}?focus=${encodeURIComponent(item.key)}`}
                  className={`rounded-full border px-3 py-1.5 text-[12px] ${selectedRoute?.key === item.key ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/68 hover:bg-black/[0.03]"}`}
                >
                  {item.title} · {routeMappingError ? "-" : routeCounts.get(item.key) || 0}
                </Link>
              ))}
            </div>
          </div>

          {selectedRoute ? (
            <div className="mt-5 rounded-[24px] border border-black/10 bg-white/92 p-4">
              <div className="text-[12px] font-semibold tracking-[0.08em] text-black/48">CURRENT ROUTE</div>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-black/88">{selectedRoute.title}</h2>
              <p className="mt-2 max-w-[760px] text-[14px] leading-[1.6] text-black/62">
                {describeMobileRouteFocus(category, selectedRoute.key)}
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-black/88">
                {selectedRoute ? `${selectedRoute.title}产品` : `${config.zh}产品`}
              </h2>
              <p className="mt-1 text-[13px] text-black/56">
                当前展示 {visibleProducts.length} 个产品{selectedRoute ? `，过滤条件为 ${selectedRoute.title}` : ""}。
              </p>
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <div className="rounded-[28px] border border-black/10 bg-white px-6 py-8 text-[14px] leading-[1.6] text-black/60">
              当前分类下暂无命中产品。{selectedRoute ? "可以切回“全部”或检查该路线的 route mapping 是否已生成。" : ""}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {visibleProducts.map((item) => {
                const mapping = mappingByProductId.get(item.id);
                return (
                  <Link key={item.id} href={`/product/${item.id}`} className="group block">
                    <div className="relative aspect-square overflow-hidden rounded-[24px] border border-black/10 bg-black/5">
                      <Image
                        src={resolveImageUrl(item)}
                        alt={item.name ?? item.brand ?? `${config.zh} 产品`}
                        fill
                        className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                    <div className="mt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-black/60">{item.brand ?? ""}</span>
                        {mapping?.primary_route_title ? (
                          <span className="rounded-full border border-black/10 bg-[#f7f8fb] px-2 py-0.5 text-[11px] text-black/62">
                            {mapping.primary_route_title}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-base font-medium tracking-tight text-black/90">
                        {item.name ?? "未命名产品"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
