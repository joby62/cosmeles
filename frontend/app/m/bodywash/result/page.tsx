import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import SelectionRecorder from "@/components/mobile/SelectionRecorder";
import { fetchProducts, resolveImageUrl } from "@/lib/api";
import {
  buildBodyWashCategoryName,
  buildBodyWashConfidenceLine,
  buildBodyWashCoreComponents,
  buildBodyWashMappingLines,
  buildBodyWashMarketingLine,
  buildBodyWashNotForLines,
  buildBodyWashResultTitle,
  buildBodyWashTraceLines,
  buildBodyWashTriggerPath,
  buildBodyWashUsageLine,
  buildBodyWashWhyNotOthers,
  buildBodyWashWhyRecommend,
  isReadyBodyWashResult,
  normalizeBodyWashSignals,
  toBodyWashSearchParams,
} from "@/lib/mobile/bodywashDecision";

type Search = Record<string, string | string[] | undefined>;

const FALLBACK_PRODUCT = {
  brand: "CeraVe",
  name: "温和保湿沐浴露",
  image_url: "",
};

export default async function BodyWashResultPage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeBodyWashSignals(raw);

  if (!isReadyBodyWashResult(signals)) {
    redirect("/m/bodywash/profile");
  }

  const resultTitle = buildBodyWashResultTitle(signals);
  const category = buildBodyWashCategoryName(signals);
  const marketingLine = buildBodyWashMarketingLine(signals);
  const triggerPath = buildBodyWashTriggerPath(signals);
  const whyRecommend = buildBodyWashWhyRecommend(signals);
  const whyNotOthers = buildBodyWashWhyNotOthers(signals);
  const notFor = buildBodyWashNotForLines(signals);
  const usage = buildBodyWashUsageLine(signals);
  const coreComponents = buildBodyWashCoreComponents(signals);
  const traceLines = buildBodyWashTraceLines(signals);
  const mappingLines = buildBodyWashMappingLines(signals);
  const confidenceLine = buildBodyWashConfidenceLine();
  const resultHref = `/m/bodywash/result?${toBodyWashSearchParams(signals).toString()}`;

  let product = null as Awaited<ReturnType<typeof fetchProducts>>[number] | null;
  try {
    const products = await fetchProducts();
    product = products.find((p) => p.category === "bodywash") || null;
  } catch {
    product = null;
  }

  const picked = product || FALLBACK_PRODUCT;

  return (
    <section className="pb-12">
      <SelectionRecorder
        record={{
          categoryKey: "bodywash",
          categoryLabel: "沐浴露",
          resultTitle: `${category} · ${resultTitle}`,
          resultSummary: marketingLine,
          signals: [...traceLines, ...mappingLines],
          resultHref,
        }}
      />

      <div className="text-[13px] font-medium text-black/45">沐浴挑选 · 最终答案</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">{resultTitle}</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/62">{category}</p>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/68">{marketingLine}</p>

      <article className="mt-6 rounded-3xl border border-black/10 bg-white p-5">
        <p className="text-[14px] leading-[1.65] text-black/70">
          这套体系不仅是成分堆叠，而是把皮肤生理学和环境物理学一起纳入决策。我们先做安全过滤，再做痛点收敛，最后做肤感修正，给你唯一结论。
        </p>

        <div className="mt-6 flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-black/[0.03]">
            {product ? (
              <Image src={resolveImageUrl(product)} alt={picked.name ?? picked.brand ?? "产品图片"} fill className="object-contain p-2" />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-black/40">Body Wash</div>
            )}
          </div>
          <div>
            <div className="text-[12px] font-medium text-black/50">唯一主推</div>
            <div className="mt-1 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] text-black/90">{picked.brand}</div>
            <div className="mt-1 text-[15px] leading-[1.45] text-black/75">{picked.name}</div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-black/85">触发路径</h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-black/72">{triggerPath}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">为什么推荐它</h2>
          <p className="mt-2 text-[14px] leading-[1.65] text-black/72">{whyRecommend}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">为什么不是别的</h2>
          <p className="mt-2 text-[14px] leading-[1.65] text-black/72">{whyNotOthers}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">哪些情况不适合</h2>
          <ul className="mt-2 space-y-2">
            {notFor.map((line) => (
              <li key={line} className="text-[14px] leading-[1.55] text-black/72">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-black/85">用法建议</h2>
          <p className="mt-1 text-[14px] leading-[1.6] text-black/72">{usage}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">核心成分作用机制</h2>
          <div className="mt-2 space-y-2.5">
            {coreComponents.map((item) => (
              <article key={item.name} className="rounded-xl border border-black/10 px-3.5 py-3">
                <h3 className="text-[13px] font-semibold text-black/86">{item.name}</h3>
                <p className="mt-1 text-[13px] leading-[1.55] text-black/66">{item.mechanism}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">问题映射记录</h2>
          <ul className="mt-2 space-y-1.5">
            {traceLines.map((line) => (
              <li key={line} className="text-[13px] leading-[1.5] text-black/66">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">过滤器收敛过程</h2>
          <ul className="mt-2 space-y-1.5">
            {mappingLines.map((line) => (
              <li key={line} className="text-[13px] leading-[1.55] text-black/66">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-black/85">置信度评估</h2>
          <p className="mt-1 text-[13px] leading-[1.55] text-black/72">{confidenceLine}</p>
        </section>
      </article>

      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link
          href="/m/wiki"
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
        >
          查看成份百科
        </Link>
        <Link
          href="/m/bodywash/start"
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          重新判断一次
        </Link>
      </div>
    </section>
  );
}
