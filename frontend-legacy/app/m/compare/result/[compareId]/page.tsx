import Link from "next/link";
import { fetchMobileCompareResult } from "@/lib/api";
import { formatRuntimeError } from "@/lib/error";
import MobileCompareResultFlow from "./result-flow";

export default async function MobileCompareResultPage({
  params,
}: {
  params: { compareId: string } | Promise<{ compareId: string }>;
}) {
  const { compareId } = await Promise.resolve(params);
  let result: Awaited<ReturnType<typeof fetchMobileCompareResult>> | null = null;
  let loadError: string | null = null;

  try {
    result = await fetchMobileCompareResult(compareId);
  } catch (err) {
    loadError = formatRuntimeError(err);
  }

  if (!result) {
    return (
      <section className="m-compare-result-page pb-12">
        <article className="rounded-[24px] border border-[#ffb39e]/55 bg-[linear-gradient(180deg,#fff8f4_0%,#fff2ed_100%)] px-5 py-5 dark:border-[#b16b58]/45 dark:bg-[linear-gradient(180deg,#35221f_0%,#2a1a18_100%)]">
          <div className="text-[12px] font-semibold tracking-[0.04em] text-[#b6543f] dark:text-[#ffb39d]">对比结果加载失败</div>
          <h1 className="mt-2 text-[26px] leading-[1.18] font-semibold tracking-[-0.02em] text-[#452016] dark:text-[#ffd5cb]">本次对比未能完成展示</h1>
          <p className="mt-3 text-[14px] leading-[1.55] text-[#6c3428] dark:text-[#f2beb1]">页面没有中断，已保留后端真实错误，方便继续排查。</p>
          <p className="mt-3 rounded-2xl border border-[#f6c6bc] bg-white/82 px-3 py-2 text-[13px] leading-[1.55] text-[#7a2d21] dark:border-[#a16a61]/45 dark:bg-[rgba(59,34,31,0.7)] dark:text-[#ffd2c8]">
            真实错误：{loadError || "unknown"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/m/compare"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(0,113,227,0.28)]"
            >
              返回横向对比
            </Link>
            <Link
              href="/m"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#202737]/18 px-5 text-[14px] font-semibold text-[#232e45] dark:border-[#6e85ad]/38 dark:text-[#d6e5ff]"
            >
              回到移动首页
            </Link>
          </div>
        </article>
      </section>
    );
  }

  return <MobileCompareResultFlow result={result} />;
}
