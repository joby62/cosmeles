import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buildCleanserReasonLines,
  buildCleanserRollbackLine,
  buildCleanserSegmentLine,
  isCompleteCleanserSignals,
  normalizeCleanserSignals,
  toCleanserSearchParams,
} from "@/lib/mobile/cleanserDecision";

type Search = Record<string, string | string[] | undefined>;

export default async function CleanserResolvePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeCleanserSignals(raw);

  if (!isCompleteCleanserSignals(signals)) {
    redirect("/m/cleanser/profile");
  }

  const segmentLine = buildCleanserSegmentLine(signals);
  const reasonLines = buildCleanserReasonLines(signals);
  const rollbackLine = buildCleanserRollbackLine(signals);
  const qp = toCleanserSearchParams(signals).toString();

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">洗面奶决策 · 收敛中</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">我们替你判断过了</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">你的 4 个信号已经收齐。下面这件，是我们给你的唯一主推。</p>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <div className="text-[13px] font-medium text-black/55">你的人群定位</div>
        <p className="mt-2 text-[14px] leading-[1.55] text-black/75">{segmentLine}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <div className="text-[13px] font-medium text-black/55">我们依据的是</div>
        <ul className="mt-3 space-y-2">
          {reasonLines.map((line) => (
            <li key={line} className="text-[14px] leading-[1.5] text-black/75">
              {line}
            </li>
          ))}
        </ul>
      </div>

      {rollbackLine && (
        <div className="mt-4 rounded-2xl border border-black/12 bg-black/[0.03] px-4 py-4">
          <div className="text-[13px] font-medium text-black/60">回退策略已触发</div>
          <p className="mt-1 text-[14px] leading-[1.5] text-black/72">{rollbackLine}</p>
        </div>
      )}

      <div className="mt-8">
        <Link
          href={`/m/cleanser/result?${qp}`}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
        >
          查看最终答案
        </Link>
      </div>
    </section>
  );
}
