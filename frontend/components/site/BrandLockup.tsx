import BrandMark from "@/components/site/BrandMark";
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
        <BrandMark size={isHeader ? 56 : 50} tone={tone} />
        <div className="min-w-0">
          <div
            className={cn(
              "font-semibold uppercase text-sky-600",
              isHeader ? "text-[10px] tracking-[0.34em]" : "text-[9px] tracking-[0.28em]",
            )}
          >
            Jeslect CN Demo
          </div>
          <div
            className={cn(
              "brand-cn-wordmark text-slate-950",
              isHeader ? "mt-1 text-[40px] leading-[0.88] tracking-[0.02em]" : "mt-1 text-[30px] leading-[0.9] tracking-[0.02em]",
            )}
          >
            婕选
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <BrandMark size={isHeader ? 44 : 40} tone={tone} />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Jeslect</div>
        <div className={cn("font-semibold tracking-[-0.03em] text-slate-950", isHeader ? "text-[18px]" : "text-[16px]")}>
          Build a routine that feels clear.
        </div>
      </div>
    </div>
  );
}
