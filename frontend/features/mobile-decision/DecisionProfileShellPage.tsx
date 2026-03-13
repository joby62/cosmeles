import { Suspense } from "react";
import DecisionProfileShellClient from "@/features/mobile-decision/DecisionProfileShellClient";
import type { MobileSelectionCategory } from "@/lib/api";
import type { DecisionShellConfig } from "@/features/mobile-decision/decisionShellConfig";
import { getDecisionShellConfig } from "@/features/mobile-decision/decisionShellConfig";

export default function DecisionProfileShellPage({
  category,
}: {
  category: MobileSelectionCategory;
}) {
  const config = getDecisionShellConfig(category);
  return (
    <Suspense fallback={<DecisionProfileFallback config={config} />}>
      <DecisionProfileShellClient category={category} />
    </Suspense>
  );
}

function DecisionProfileFallback({ config }: { config: DecisionShellConfig }) {
  return (
    <section className="pb-8">
      <div className="m-profile-step">
        <div className="m-profile-step-index">
          {config.titlePrefix} · 第 1/{config.steps.length} 步
        </div>
        <h1 className="m-profile-step-title">正在准备问题…</h1>
        <p className="m-profile-step-note">请稍候，马上进入测配流程。</p>
      </div>
    </section>
  );
}
