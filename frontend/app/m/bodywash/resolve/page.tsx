import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buildBodyWashCategoryName,
  buildBodyWashConfidenceLine,
  buildBodyWashCoreComponents,
  buildBodyWashMappingLines,
  buildBodyWashMarketingLine,
  buildBodyWashResultTitle,
  buildBodyWashRobustLines,
  buildBodyWashTraceLines,
  buildBodyWashTriggerPath,
  buildBodyWashWhyRecommend,
  isReadyBodyWashResult,
  normalizeBodyWashSignals,
  toBodyWashSearchParams,
} from "@/lib/mobile/bodywashDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function BodyWashResolvePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeBodyWashSignals(raw);

  if (!isReadyBodyWashResult(signals)) {
    redirect("/m/bodywash/profile");
  }

  const title = buildBodyWashResultTitle(signals);
  const category = buildBodyWashCategoryName(signals);
  const marketing = buildBodyWashMarketingLine(signals);
  const triggerPath = buildBodyWashTriggerPath(signals);
  const whyRecommend = buildBodyWashWhyRecommend(signals);
  const traceLines = buildBodyWashTraceLines(signals);
  const mappingLines = buildBodyWashMappingLines(signals);
  const coreComponents = buildBodyWashCoreComponents(signals);
  const robustLines = buildBodyWashRobustLines();
  const confidenceLine = buildBodyWashConfidenceLine();
  const qp = toBodyWashSearchParams(signals).toString();

  return (
    <section className="pb-10">
      <div className="text-[13px] font-medium text-black/45">沐浴挑选 · 收敛完成</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">{title}</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/62">{category}</p>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/66">{marketing}</p>

      <section className="mt-6 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">触发路径</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-black/72">{triggerPath}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">为什么先推荐这一型</h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-black/72">{whyRecommend}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">问题映射记录</h2>
        <ul className="mt-2 space-y-1.5">
          {traceLines.map((line) => (
            <li key={line} className="text-[13px] leading-[1.5] text-black/68">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">过滤器收敛逻辑</h2>
        <ul className="mt-2 space-y-2">
          {mappingLines.map((line) => (
            <li key={line} className="text-[13px] leading-[1.55] text-black/68">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">核心成分预览</h2>
        <ul className="mt-2 space-y-2">
          {coreComponents.map((item) => (
            <li key={item.name} className="text-[13px] leading-[1.55] text-black/68">
              <span className="font-semibold text-black/82">{item.name}：</span>
              {item.mechanism}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">置信与鲁棒性</h2>
        <p className="mt-2 text-[13px] leading-[1.5] text-black/72">{confidenceLine}</p>
        <ul className="mt-2 space-y-1.5">
          {robustLines.map((line) => (
            <li key={line} className="text-[13px] leading-[1.5] text-black/66">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link
          href={`/m/bodywash/result?${qp}`}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
        >
          查看结果卡
        </Link>
        <Link
          href="/m/bodywash/start"
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          重新回答
        </Link>
      </div>
    </section>
  );
}
