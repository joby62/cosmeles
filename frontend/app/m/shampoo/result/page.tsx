import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import SelectionRecorder from "@/components/mobile/SelectionRecorder";
import { fetchProducts, resolveImageUrl } from "@/lib/api";
import {
  SHAMPOO_FEATURED_PRODUCT_ID,
  buildShampooCoreIngredients,
  buildShampooFitRule,
  buildShampooNotForLines,
  buildShampooReasonLines,
  buildShampooResultTitle,
  buildShampooTraceLines,
  buildShampooUsageLine,
  buildShampooWhyNotOthers,
  buildShampooWhyRecommend,
  buildShampooWikiDeepHref,
  isReadyShampooResult,
  normalizeShampooSignals,
  toSignalSearchParams,
} from "@/lib/mobile/shampooDecision";

type Search = Record<string, string | string[] | undefined>;

const FALLBACK_PRODUCT = {
  brand: "多芬",
  name: "空气丰盈保湿洗发露（日本版）",
  image_url: "",
};

export default async function ShampooResultPage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeShampooSignals(raw);

  if (!isReadyShampooResult(signals)) {
    redirect("/m/shampoo/profile");
  }

  const traceLines = buildShampooTraceLines(signals);
  const reasonLines = buildShampooReasonLines(signals);
  const whyRecommend = buildShampooWhyRecommend(signals);
  const whyNotOthers = buildShampooWhyNotOthers(signals);
  const notFor = buildShampooNotForLines(signals);
  const usage = buildShampooUsageLine(signals);
  const fitRule = buildShampooFitRule(signals);
  const resultTitle = buildShampooResultTitle(signals);
  const coreIngredients = buildShampooCoreIngredients(signals);
  const wikiHref = buildShampooWikiDeepHref(signals);
  const resultHref = `/m/shampoo/result?${toSignalSearchParams(signals).toString()}`;

  let product = null as Awaited<ReturnType<typeof fetchProducts>>[number] | null;
  try {
    const products = await fetchProducts();
    product = products.find((p) => p.id === SHAMPOO_FEATURED_PRODUCT_ID) || null;
  } catch {
    product = null;
  }

  const picked = product || FALLBACK_PRODUCT;

  return (
    <section className="pb-12">
      <SelectionRecorder
        record={{
          categoryKey: "shampoo",
          categoryLabel: "洗发水",
          resultTitle: `${picked.brand} ${picked.name}`,
          resultSummary: `${resultTitle}：${whyRecommend}`,
          signals: [...traceLines, ...reasonLines],
          resultHref,
        }}
      />

      <div className="text-[13px] font-medium text-black/45">洗发挑选 · 最终答案</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">{resultTitle}</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/62">{fitRule}</p>

      <article className="mt-6 rounded-3xl border border-black/10 bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-black/[0.03]">
            {product ? (
              <Image src={resolveImageUrl(product)} alt={picked.name} fill className="object-contain p-2" />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-black/40">Shampoo</div>
            )}
          </div>
          <div>
            <div className="text-[12px] font-medium text-black/50">唯一主推</div>
            <div className="mt-1 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] text-black/90">{picked.brand}</div>
            <div className="mt-1 text-[15px] leading-[1.45] text-black/75">{picked.name}</div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-black/85">你的选择记录</h2>
          <ul className="mt-2 space-y-1.5">
            {traceLines.map((line) => (
              <li key={line} className="text-[13px] leading-[1.5] text-black/68">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">为什么推荐它</h2>
          <p className="mt-2 text-[14px] leading-[1.6] text-black/70">{whyRecommend}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">为什么不是别的</h2>
          <p className="mt-2 text-[14px] leading-[1.6] text-black/70">{whyNotOthers}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">哪些情况不适合</h2>
          <ul className="mt-2 space-y-2">
            {notFor.map((line) => (
              <li key={line} className="text-[14px] leading-[1.55] text-black/70">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-black/85">用法建议</h2>
          <p className="mt-1 text-[14px] leading-[1.55] text-black/70">{usage}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">核心成分作用机制</h2>
          <div className="mt-2 space-y-2.5">
            {coreIngredients.map((item) => (
              <article key={item.name} className="rounded-xl border border-black/10 px-3.5 py-3">
                <h3 className="text-[13px] font-semibold text-black/86">{item.name}</h3>
                <p className="mt-1 text-[13px] leading-[1.55] text-black/65">{item.mechanism}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">过滤器收敛过程</h2>
          <ul className="mt-2 space-y-2">
            {reasonLines.map((line) => (
              <li key={line} className="text-[13px] leading-[1.55] text-black/67">
                {line}
              </li>
            ))}
          </ul>
        </section>
      </article>

      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link
          href={wikiHref}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
        >
          深层成份跳转
        </Link>
        <Link
          href="/m/shampoo/start"
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          重新判断一次
        </Link>
      </div>
    </section>
  );
}
