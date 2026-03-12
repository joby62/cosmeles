import Link from "next/link";
import { redirect } from "next/navigation";
import SelectionResultFlow from "@/components/mobile/SelectionResultFlow";
import { fetchMobileSelectionFitExplanation, resolveMobileSelection } from "@/lib/api";
import { formatRuntimeError } from "@/lib/error";
import { applyResultCtaAttribution, parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";

type Search = Record<string, string | string[] | undefined>;

function getValue(raw: Search, key: string): string | null {
  const value = raw[key];
  const picked = Array.isArray(value) ? value[0] : value;
  return typeof picked === "string" && picked.trim() ? picked.trim() : null;
}

function parseAnswers(raw: Search): Record<string, string> | null {
  const cQ1 = getValue(raw, "c_q1");
  const cQ2 = getValue(raw, "c_q2");
  const cQ3 = getValue(raw, "c_q3");
  if (!cQ1 || !cQ2 || !cQ3) return null;
  return { c_q1: cQ1, c_q2: cQ2, c_q3: cQ3 };
}

export default async function ConditionerResultPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const attribution = parseResultCtaAttribution(raw);
  const startParams = new URLSearchParams({ step: "1" });
  applyResultCtaAttribution(startParams, attribution);
  const startHref = `/m/conditioner/profile?${startParams.toString()}`;
  const profileParams = new URLSearchParams();
  applyResultCtaAttribution(profileParams, attribution);
  const profileQuery = profileParams.toString();
  const profileHref = profileQuery ? `/m/conditioner/profile?${profileQuery}` : "/m/conditioner/profile";
  const answers = parseAnswers(raw);
  if (!answers) {
    redirect(profileHref);
  }

  let resolved: Awaited<ReturnType<typeof resolveMobileSelection>> | null = null;
  let resolveError: string | null = null;
  try {
    resolved = await resolveMobileSelection({
      category: "conditioner",
      answers,
      reuse_existing: true,
    });
  } catch (err) {
    resolveError = formatRuntimeError(err);
  }

  if (!resolved) {
    return (
      <section className="pb-12">
        <article className="rounded-[24px] border border-[#ffb39e]/55 bg-[linear-gradient(180deg,#fff8f4_0%,#fff2ed_100%)] px-5 py-5">
          <div className="text-[12px] font-semibold tracking-[0.04em] text-[#b6543f]">结果生成失败</div>
          <h1 className="mt-2 text-[26px] leading-[1.18] font-semibold tracking-[-0.02em] text-[#452016]">护发素推荐暂时不可用</h1>
          <p className="mt-3 text-[14px] leading-[1.55] text-[#6c3428]">已阻止页面崩溃，并展示后端返回的真实错误。</p>
          <p className="mt-3 rounded-2xl border border-[#f6c6bc] bg-white/82 px-3 py-2 text-[13px] leading-[1.55] text-[#7a2d21]">
            真实错误：{resolveError || "unknown"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href={startHref}
              className="inline-flex h-10 items-center justify-center rounded-full bg-black px-4 text-[14px] font-semibold text-white"
            >
              重新开始
            </Link>
            <Link
              href={profileHref}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-4 text-[14px] font-semibold text-black/78"
            >
              返回个人情况
            </Link>
          </div>
        </article>
      </section>
    );
  }

  let explanation: Awaited<ReturnType<typeof fetchMobileSelectionFitExplanation>> | null = null;
  let explanationError: string | null = null;
  try {
    explanation = await fetchMobileSelectionFitExplanation(resolved.session_id);
  } catch (err) {
    explanationError = formatRuntimeError(err);
  }

  return (
    <SelectionResultFlow
      titlePrefix="护发素决策"
      emptyImageLabel="Conditioner"
      startHref={startHref}
      profileHref={profileHref}
      resolved={resolved}
      explanation={explanation?.item || null}
      explanationError={explanationError}
      analyticsContext={
        attribution
          ? {
              page: "selection_result",
              route: "/m/conditioner/result",
              source: attribution.source || "m_compare_result",
              resultCta: attribution.resultCta,
              fromCompareId: attribution.fromCompareId,
            }
          : null
      }
    />
  );
}
