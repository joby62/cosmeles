"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  dismissMobileLocationPrompt,
  getStoredMobileLocationContext,
  getStoredMobileLocationPromptState,
  requestMobileLocationContext,
  trackMobileEvent,
} from "@/lib/mobileAnalytics";

function errorLabel(reason: string): string {
  switch (reason) {
    case "position_unavailable":
      return "这次没拿到可用位置，请稍后再试。";
    case "timeout":
      return "定位超时了，你可以稍后重试。";
    default:
      return "暂时拿不到位置，你可以继续使用，不会影响主流程。";
  }
}

export default function MobileLocationConsent() {
  const pathname = usePathname() || "/m";
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedState = getStoredMobileLocationPromptState();
      const storedContext = getStoredMobileLocationContext();
      if (storedState === "dismissed" || storedState === "denied") {
        setVisible(false);
        return;
      }
      if (storedState === "granted" && storedContext) {
        setVisible(false);
        return;
      }
      setVisible(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  async function allowLocation() {
    setPending(true);
    setError(null);
    const result = await requestMobileLocationContext();
    setPending(false);
    if (result.status === "granted") {
      setVisible(false);
      void trackMobileEvent("location_context_captured", {
        page: "mobile_shell",
        route: pathname,
        source: "mobile_location_consent",
        detail: `近似位置 ${result.context.location_label}`,
        ...result.context,
      });
      return;
    }
    if (result.status === "denied" || result.status === "unsupported") {
      setVisible(false);
      return;
    }
    setError(errorLabel(result.reason));
  }

  function skipLocation() {
    dismissMobileLocationPrompt();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+86px)] z-40 px-4">
      <div className="pointer-events-auto mx-auto max-w-[680px] rounded-[28px] border border-[#d7e6fb] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,251,255,0.96)_100%)] px-4 py-4 shadow-[0_20px_50px_rgba(26,56,107,0.16)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[420px]">
            <div className="text-[12px] font-semibold tracking-[0.08em] text-[#356ab7] uppercase">位置授权</div>
            <div className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-black/86">允许读取当前位置，用作内容呈现依据之一</div>
            <p className="mt-2 text-[13px] leading-[1.65] text-black/62">
              只在你同意后记录近似位置；如果拒绝，我们就忽略，不影响浏览和对比主流程。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={skipLocation}
              disabled={pending}
              className="inline-flex h-10 items-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black/62 disabled:opacity-45"
            >
              暂不使用
            </button>
            <button
              type="button"
              onClick={() => void allowLocation()}
              disabled={pending}
              className="inline-flex h-10 items-center rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:opacity-45"
            >
              {pending ? "请求中…" : "允许位置"}
            </button>
          </div>
        </div>

        {error ? <div className="mt-3 rounded-[18px] border border-[#f0b3ab] bg-[#fff4f2] px-3 py-3 text-[12px] leading-[1.6] text-[#7f2b21]">{error}</div> : null}
      </div>
    </aside>
  );
}
