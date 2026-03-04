"use client";

import { useState } from "react";
import { upsertMobileBagItem } from "@/lib/api";

export default function AddToBagButton({
  productId,
  className = "",
  compact = false,
}: {
  productId: string;
  className?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          const pid = productId.trim();
          if (!pid) {
            setError("product_id 为空，无法加入购物袋。");
            return;
          }
          setBusy(true);
          setError(null);
          setDone(false);
          try {
            await upsertMobileBagItem({ product_id: pid, quantity: 1 });
            setDone(true);
            window.setTimeout(() => setDone(false), 1600);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
        className={`inline-flex items-center justify-center rounded-full border text-[12px] font-semibold ${
          compact ? "h-8 px-3" : "h-10 px-4"
        } ${
          done
            ? "border-[#1f7a45]/35 bg-[#eaf8ef] text-[#116a3f]"
            : "border-black/15 bg-white text-black/78 active:bg-black/[0.03]"
        } disabled:opacity-55`}
      >
        {busy ? "加入中..." : done ? "已加入" : "加入购物袋"}
      </button>
      {error ? <div className="mt-1 text-[11px] text-[#b42318]">错误：{error}</div> : null}
    </div>
  );
}
