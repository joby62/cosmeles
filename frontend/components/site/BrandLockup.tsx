import type { DemoLocale } from "@/components/site/DemoLocaleProvider";

type BrandLockupProps = {
  locale: DemoLocale;
  tone?: "header" | "footer";
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function BrandLockup({ locale, tone = "header" }: BrandLockupProps) {
  const isHeader = tone === "header";

  if (locale === "zh") {
    return (
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex shrink-0 flex-col items-center justify-center rounded-[18px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(242,247,252,0.96)_100%)] shadow-[0_14px_34px_rgba(15,23,42,0.08)]",
            isHeader ? "h-12 w-12" : "h-11 w-11",
          )}
        >
          <span className={cn("brand-cn-glyph leading-none text-slate-950", isHeader ? "text-[18px]" : "text-[17px]")}>婕</span>
          <span className={cn("brand-cn-glyph -mt-1 leading-none text-slate-950", isHeader ? "text-[18px]" : "text-[17px]")}>选</span>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-600">Jeslect CN Demo</div>
          <div className={cn("brand-cn-wordmark text-slate-950", isHeader ? "text-[28px] leading-none" : "text-[24px] leading-none")}>婕选</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Jeslect</div>
      <div className={cn("font-semibold tracking-[-0.03em] text-slate-950", isHeader ? "text-[18px]" : "text-[16px]")}>
        Build a routine that feels clear.
      </div>
    </div>
  );
}
