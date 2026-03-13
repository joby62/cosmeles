"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  appendSourceToPath,
  readDecisionResumeItem,
  type DecisionResumeItem,
} from "@/domain/mobile/progress/decisionResume";
import type { MobileUtilityRouteState } from "@/features/mobile-utility/routeState";

type Props = {
  routeState: MobileUtilityRouteState;
};

function describeResumeAction(item: DecisionResumeItem): string {
  if (item.kind === "result") return "查看最近结果";
  return `继续 ${item.answeredCount}/${item.totalSteps}`;
}

export default function MeDecisionResumeCard({ routeState }: Props) {
  const [resumeItem, setResumeItem] = useState<DecisionResumeItem | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncResume = () => {
      setResumeItem(readDecisionResumeItem(window.localStorage));
    };

    const rafId = window.requestAnimationFrame(syncResume);
    window.addEventListener("focus", syncResume);
    window.addEventListener("storage", syncResume);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("focus", syncResume);
      window.removeEventListener("storage", syncResume);
    };
  }, []);

  const resumeHref = useMemo(() => {
    if (!resumeItem) return "";
    const source = routeState.source || "m_me_resume";
    return appendSourceToPath(resumeItem.targetPath, source);
  }, [resumeItem, routeState.source]);

  if (!resumeItem || !resumeHref) return null;

  return (
    <article className="rounded-[24px] border border-[#cfe2ff] bg-[linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)] px-4 py-4 text-[#2450a3] shadow-[0_10px_24px_rgba(36,80,163,0.08)]">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-[#3b67b6]">继续上次个性测配</p>
      <p className="mt-2 text-[15px] font-semibold leading-[1.5]">
        {resumeItem.labelZh} · {resumeItem.kind === "result" ? "已有最近结果" : "存在未完成问答"}
      </p>
      <p className="mt-1 text-[12px] text-[#4469ab]">
        {resumeItem.kind === "result"
          ? "你可以直接回到最近一次结果页。"
          : `已完成 ${resumeItem.answeredCount}/${resumeItem.totalSteps} 步，继续即可。`}
      </p>
      <div className="mt-3">
        <Link
          href={resumeHref}
          className="m-pressable inline-flex h-9 items-center justify-center rounded-full border border-[#9ec0ff] bg-white/85 px-4 text-[13px] font-semibold text-[#2450a3] active:bg-white"
        >
          {describeResumeAction(resumeItem)}
        </Link>
      </div>
    </article>
  );
}
