"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  DECISION_CONTINUATION_SOURCE,
  resolveDecisionContinuationSource,
} from "@/features/mobile-decision/decisionEntryHref";
import {
  appendMobileUtilityRouteState,
  type MobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";
import { describeDecisionContinuationAction } from "@/features/mobile-utility/decisionContinuationCopy";
import { useDecisionContinuationMap } from "@/features/mobile-utility/useDecisionContinuation";

type Props = {
  routeState: MobileUtilityRouteState;
};

export default function MeDecisionResumeCard({ routeState }: Props) {
  const source = resolveDecisionContinuationSource(
    routeState.source,
    DECISION_CONTINUATION_SOURCE.meResume,
  );
  const continuation = useDecisionContinuationMap({ source });
  const target = continuation?.defaultTarget || null;
  const resumeHref = useMemo(() => {
    if (!target) return "";
    return appendMobileUtilityRouteState(target.href, routeState, { includeSource: false });
  }, [routeState, target]);
  const heading = useMemo(() => {
    if (!target) return "";
    if (target.action === "resume_profile") return "未完成答题";
    if (target.action === "reopen_result") return "最近完成结果";
    return "继续选择";
  }, [target]);

  if (!target || !resumeHref) return null;

  return (
    <article className="rounded-[24px] border border-[#cfe2ff] bg-[linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)] px-4 py-4 text-[#2450a3] shadow-[0_10px_24px_rgba(36,80,163,0.08)]">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-[#3b67b6]">{heading}</p>
      <p className="mt-2 text-[15px] font-semibold leading-[1.5]">{target.titleZh}</p>
      <p className="mt-1 text-[12px] text-[#4469ab]">{target.descriptionZh}</p>
      <div className="mt-3">
        <Link
          href={resumeHref}
          className="m-pressable inline-flex h-9 items-center justify-center rounded-full border border-[#9ec0ff] bg-white/85 px-4 text-[13px] font-semibold text-[#2450a3] active:bg-white"
        >
          {describeDecisionContinuationAction(target.action)}
        </Link>
      </div>
    </article>
  );
}
