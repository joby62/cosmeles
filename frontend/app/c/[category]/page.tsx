import { fetchProducts, resolveImageUrl } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { CATEGORY_CONFIG } from "@/lib/catalog";
import { formatRuntimeError } from "@/lib/error";

type Params = { category: string };

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { category } = await Promise.resolve(params);
  let products: Awaited<ReturnType<typeof fetchProducts>> = [];
  let loadError: string | null = null;
  try {
    products = await fetchProducts();
  } catch (err) {
    loadError = formatRuntimeError(err);
  }
  const filtered = products.filter((p) => p.category === category);

  const title =
    CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.zh ?? category;

  if (loadError) {
    return (
      <main className="min-h-screen px-6 pt-14 pb-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#ff9b8f]/55 bg-[#fff1ef] p-6 text-[#8e2e22]">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#7b261d]">{title} 暂时不可用</h1>
          <p className="mt-3 text-[14px] leading-[1.6]">后端接口报错，已阻止页面崩溃并保留错误信息供排查。</p>
          <p className="mt-2 rounded-2xl border border-[#f2b0a8]/80 bg-[#fff8f7] px-3 py-2 text-[13px] leading-[1.55]">
            真实错误：{loadError}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href="/" className="inline-flex h-10 items-center justify-center rounded-full bg-black px-4 text-[14px] font-semibold text-white">
              返回首页
            </Link>
            <Link
              href={`/m/compare?category=${encodeURIComponent(category)}`}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-4 text-[14px] font-semibold text-black/78"
            >
              去横向对比
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 pt-14 pb-16">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {title}
        </h1>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {filtered.map((p) => (
            <Link key={p.id} href={`/product/${p.id}`} className="group block">
              <div className="relative aspect-square bg-black/5 border border-black/10 overflow-hidden">
                <Image
                  src={resolveImageUrl(p)}
                  alt={p.name ?? p.brand ?? `${title} 产品`}
                  fill
                  className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <div className="mt-4">
                <div className="text-xs text-black/60">{p.brand ?? ""}</div>
                <div className="mt-1 text-base font-medium tracking-tight text-black/90">
                  {p.name ?? "未命名产品"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
