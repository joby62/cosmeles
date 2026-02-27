import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buildShampooCoreIngredients,
  buildShampooFitRule,
  buildShampooReasonLines,
  buildShampooResultTitle,
  buildShampooTraceLines,
  buildShampooWhyRecommend,
  buildShampooWikiDeepHref,
  isReadyShampooResult,
  isShampooFastPath,
  normalizeShampooSignals,
  toSignalSearchParams,
} from "@/lib/mobile/shampooDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function ShampooResolvePage({
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
  const title = buildShampooResultTitle(signals);
  const fitRule = buildShampooFitRule(signals);
  const whyRecommend = buildShampooWhyRecommend(signals);
  const coreIngredients = buildShampooCoreIngredients(signals);
  const resultHref = `/m/shampoo/result?${toSignalSearchParams(signals).toString()}`;
  const wikiHref = buildShampooWikiDeepHref(signals);

  return (
    <section className="pb-10">
      <div className="text-[13px] font-medium text-black/45">洗发挑选 · 收敛完成</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">{title}</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/62">{fitRule}</p>

      {isShampooFastPath(signals) && (
        <p className="mt-2 text-[13px] leading-[1.5] text-black/50">你触发了快路径，本页仅做解释，点下方即可直接看完整结果卡。</p>
      )}

      <section className="mt-6 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">为什么先收敛到这一型</h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-black/70">{whyRecommend}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">你的选择记录</h2>
        <ul className="mt-2 space-y-1.5">
          {traceLines.map((line) => (
            <li key={line} className="text-[13px] leading-[1.5] text-black/65">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">决策过滤器</h2>
        <ul className="mt-2 space-y-2">
          {reasonLines.map((line) => (
            <li key={line} className="text-[13px] leading-[1.55] text-black/68">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[14px] font-semibold text-black/85">这型重点看这 3 类成分</h2>
        <ul className="mt-2 space-y-2">
          {coreIngredients.map((item) => (
            <li key={item.name} className="text-[13px] leading-[1.55] text-black/68">
              <span className="font-semibold text-black/80">{item.name}：</span>
              {item.mechanism}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link
          href={resultHref}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
        >
          查看完整结果卡
        </Link>
        <Link
          href={wikiHref}
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          查看成份深层解析
        </Link>
      </div>
    </section>
  );
}
