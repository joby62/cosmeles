import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buildBodyWashReasonLines,
  isCompleteBodyWashSignals,
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

  if (!isCompleteBodyWashSignals(signals)) {
    redirect("/m/bodywash/profile");
  }

  const reasonLines = buildBodyWashReasonLines(signals);
  const qp = toBodyWashSearchParams(signals).toString();

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">沐浴露决策 · 收敛中</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">我们替你判断过了</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        你的 4 个信号已经收齐。下面这件，是我们对你当前状态的唯一主推。
      </p>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white px-4 py-4">
        <div className="text-[13px] font-medium text-black/55">我们依据的是</div>
        <ul className="mt-3 space-y-2">
          {reasonLines.map((line) => (
            <li key={line} className="text-[14px] leading-[1.5] text-black/75">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <Link
          href={`/m/bodywash/result?${qp}`}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
        >
          查看最终答案
        </Link>
      </div>
    </section>
  );
}
