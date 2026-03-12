"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  canRequestMobileLocationContext,
  dismissMobileLocationPrompt,
  getStoredMobileLocationContext,
  getStoredMobileLocationPromptState,
  requestMobileLocationContext,
  trackMobileEvent,
} from "@/lib/mobileAnalytics";

type LocationConsentScenario = "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

type LocationConsentCopy = {
  eyebrow: string;
  title: string;
  description: string;
  skipLabel: string;
  allowLabel: string;
};

const COPY_BY_SCENARIO: Record<LocationConsentScenario, LocationConsentCopy> = {
  shampoo: {
    eyebrow: "气候微调",
    title: "允许结合你所在气候，微调洗发建议",
    description: "湿度、温差和季节会影响头皮出油、蓬松感和清洁舒适度。只在你同意后记录近似位置，不取精确地址。",
    skipLabel: "先按通用题做",
    allowLabel: "允许按气候微调",
  },
  bodywash: {
    eyebrow: "气候微调",
    title: "允许结合你所在气候，微调沐浴建议",
    description: "干冷、闷热和换季环境会影响紧绷、出油和粗糙感。只在你同意后记录近似位置，不取精确地址。",
    skipLabel: "先按通用题做",
    allowLabel: "允许按气候微调",
  },
  conditioner: {
    eyebrow: "气候微调",
    title: "允许结合你所在气候，微调护发建议",
    description: "湿热和干燥环境会影响毛躁、静电、贴头皮和顺滑持久度。只在你同意后记录近似位置，不取精确地址。",
    skipLabel: "先按通用题做",
    allowLabel: "允许按气候微调",
  },
  lotion: {
    eyebrow: "气候微调",
    title: "允许结合你所在气候，微调润肤建议",
    description: "气候会直接影响干痒、紧绷和保湿续航。只在你同意后记录近似位置，不取精确地址。",
    skipLabel: "先按通用题做",
    allowLabel: "允许按气候微调",
  },
  cleanser: {
    eyebrow: "气候微调",
    title: "允许结合你所在气候，微调洁面建议",
    description: "不同气候会影响出油速度、洗后紧绷感和清洁强度选择。只在你同意后记录近似位置，不取精确地址。",
    skipLabel: "先按通用题做",
    allowLabel: "允许按气候微调",
  },
};

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

export default function MobileLocationConsent({ scenario }: { scenario: LocationConsentScenario }) {
  const pathname = usePathname() || "/m";
  const copy = COPY_BY_SCENARIO[scenario];
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!canRequestMobileLocationContext()) {
        setVisible(false);
        return;
      }
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
        page: "selection_profile",
        route: pathname,
        source: `mobile_profile_location_consent:${scenario}`,
        category: scenario,
        detail: `${copy.title} · 近似位置 ${result.context.location_label}`,
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
    <div className="mt-4 rounded-[28px] border border-[#d7e6fb] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,251,255,0.96)_100%)] px-4 py-4 shadow-[0_20px_50px_rgba(26,56,107,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[420px]">
            <div className="text-[12px] font-semibold tracking-[0.08em] text-[#356ab7] uppercase">{copy.eyebrow}</div>
            <div className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-black/86">{copy.title}</div>
            <p className="mt-2 text-[13px] leading-[1.65] text-black/62">{copy.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={skipLocation}
              disabled={pending}
              className="inline-flex h-10 items-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black/62 disabled:opacity-45"
            >
              {copy.skipLabel}
            </button>
            <button
              type="button"
              onClick={() => void allowLocation()}
              disabled={pending}
              className="inline-flex h-10 items-center rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:opacity-45"
            >
              {pending ? "请求中…" : copy.allowLabel}
            </button>
          </div>
        </div>

        {error ? <div className="mt-3 rounded-[18px] border border-[#f0b3ab] bg-[#fff4f2] px-3 py-3 text-[12px] leading-[1.6] text-[#7f2b21]">{error}</div> : null}
    </div>
  );
}
