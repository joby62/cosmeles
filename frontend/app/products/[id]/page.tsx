import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { fetchProduct } from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 md:mt-12">
      <h2 className="text-[17px] md:text-[19px] font-semibold tracking-[-0.01em] text-black/90">
        {title}
      </h2>
      <div className="mt-3 text-[15px] md:text-[16px] leading-7 text-black/70">
        {children}
      </div>
    </section>
  );
}

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await fetchProduct(params.id).catch(() => null);
  if (!product) return notFound();

  const categoryMeta =
    (product.category && (CATEGORY_CONFIG as any)[product.category]) || null;

  const tags: string[] = Array.isArray(product.tags) ? product.tags : [];
  const intro =
    product.one_sentence ||
    product.description ||
    "一款被我们留下的选择。";

  return (
    <div className="pb-16">
      {/* Breadcrumb */}
      <div className="text-[12px] tracking-[0.02em] text-black/55">
        <Link className="hover:text-black/75" href="/">
          首页
        </Link>
        <span className="mx-2">/</span>
        {categoryMeta ? (
          <Link className="hover:text-black/75" href={`/c/${categoryMeta.key}`}>
            {categoryMeta.zh}
          </Link>
        ) : (
          <span>产品</span>
        )}
      </div>

      {/* Hero: Apple-like split (image + text) */}
      <div className="mt-6 grid grid-cols-1 gap-8 md:mt-8 md:grid-cols-12 md:gap-10">
        {/* Image surface */}
        <div className="md:col-span-7">
          <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-white">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={product.image_url || "/placeholder/product.png"}
                alt={product.name}
                fill
                className="object-contain p-8 md:p-10"
                priority
              />
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="md:col-span-5 md:pt-2">
          <h1 className="text-[40px] md:text-[48px] font-semibold tracking-[-0.02em] leading-[1.06] text-black/90">
            {product.name}
          </h1>

          <p className="mt-3 text-[17px] md:text-[19px] leading-7 text-black/65">
            {intro}
          </p>

          {/* Key points */}
          <div className="mt-5 flex flex-wrap gap-2">
            {(tags.length ? tags : ["温和", "日常可用", "更克制的配方表达"]).slice(0, 6).map((t) => (
              <span
                key={t}
                className="rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 text-[12px] tracking-[0.02em] text-black/70"
              >
                {t}
              </span>
            ))}
          </div>

          {/* Meta */}
          <div className="mt-6 rounded-[20px] border border-black/[0.06] bg-white/70 p-4">
            <div className="text-[12px] tracking-[0.02em] text-black/55">
              规格信息
            </div>
            <div className="mt-2 space-y-1 text-[14px] text-black/75">
              <div>
                <span className="text-black/45">品类：</span>
                {categoryMeta?.zh ?? product.category ?? "—"}
              </div>
              <div>
                <span className="text-black/45">品牌：</span>
                {product.brand || "—"}
              </div>
            </div>
          </div>

          {/* Actions (Apple-ish buttons) */}
          <div className="mt-6 flex gap-3">
            <Link
              href="/compare"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/[0.10] bg-white px-4 text-[13px] font-medium tracking-[0.02em] text-black/85 hover:bg-black/[0.04] transition"
            >
              加入横向对比
            </Link>
            <Link
              href={categoryMeta ? `/c/${categoryMeta.key}` : "/"}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#0071e3] px-4 text-[13px] font-semibold tracking-[0.02em] text-white hover:opacity-95 active:opacity-90 transition"
            >
              返回浏览
            </Link>
          </div>
        </div>
      </div>

      {/* Sections */}
      <Section title="为什么是它">
        <p>
          我们把同类产品放到一起，用尽可能一致的标准去看：成分结构、刺激风险、肤感与复购概率。
          <br />
          这款是“留下来”的那个。
        </p>
      </Section>

      <Section title="成分与功效">
        <p>
          这里会逐步补齐：核心表活/保湿/修护/香精策略、潜在刺激项、以及你后续上传比对时的结论输出。
        </p>
      </Section>

      <Section title="适用人群">
        <ul className="list-disc pl-5">
          <li>想要更低刺激、日常稳定的使用体验</li>
          <li>不追求强香与强功效堆料，更在意“长期舒服”</li>
          <li>希望配方逻辑清晰，可横向对比</li>
        </ul>
      </Section>

      <Section title="怎么用">
        <ul className="list-disc pl-5">
          <li>先少量试用（特别是敏感人群）</li>
          <li>按品类（洗发/沐浴/洁面）正常频率即可</li>
          <li>后续你启用 upload/对比模块后，这里可以直接展示“匹配度”</li>
        </ul>
      </Section>
    </div>
  );
}