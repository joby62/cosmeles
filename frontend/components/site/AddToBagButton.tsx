"use client";

import { useState } from "react";
import { useSitePreferences } from "@/components/site/SitePreferenceProvider";
import { upsertMobileBagItem } from "@/lib/api";

type AddToBagButtonProps = {
  productId: string;
  className?: string;
  compact?: boolean;
};

export default function AddToBagButton({ productId, className = "", compact = false }: AddToBagButtonProps) {
  const { locale } = useSitePreferences();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy =
    locale === "zh"
      ? {
          missing: "缺少商品 ID。",
          busy: "加入中...",
          done: "已加入",
          idle: "加入袋中",
        }
      : {
          missing: "Missing product id.",
          busy: "Adding...",
          done: "Added",
          idle: "Add to bag",
        };

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          const value = productId.trim();
          if (!value) {
            setError(copy.missing);
            return;
          }

          setBusy(true);
          setDone(false);
          setError(null);
          try {
            await upsertMobileBagItem({ product_id: value, quantity: 1 });
            setDone(true);
            window.setTimeout(() => setDone(false), 1800);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
        className={`inline-flex items-center justify-center rounded-full font-semibold transition disabled:opacity-60 ${
          compact ? "h-9 px-4 text-[12px]" : "h-11 px-5 text-[13px]"
        } ${
          done
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
            : "bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-white shadow-[0_12px_30px_rgba(0,113,227,0.26)] hover:brightness-[1.03]"
        }`}
      >
        {busy ? copy.busy : done ? copy.done : copy.idle}
      </button>
      {error ? <p className="mt-2 text-[12px] text-rose-600">{error}</p> : null}
    </div>
  );
}
