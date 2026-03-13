import { Suspense } from "react";
import LotionProfileFlowClient from "./profile-flow-client";

function ProfileFallback() {
  return (
    <section className="pb-8">
      <div className="m-profile-step">
        <div className="m-profile-step-index">润肤霜决策 · 第 1/5 步</div>
        <h1 className="m-profile-step-title">正在准备问题…</h1>
        <p className="m-profile-step-note">请稍候，马上进入测配流程。</p>
      </div>
    </section>
  );
}

export default function LotionProfilePage() {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <LotionProfileFlowClient />
    </Suspense>
  );
}
