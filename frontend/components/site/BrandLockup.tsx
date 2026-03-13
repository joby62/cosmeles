import BrandMark from "@/components/site/BrandMark";

type BrandLockupProps = {
  tone?: "header" | "footer";
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function BrandLockup({ tone = "header" }: BrandLockupProps) {
  const isHeader = tone === "header";

  return (
    <div className="flex items-center gap-3">
      <BrandMark size={isHeader ? 56 : 48} tone={tone} />
      <div className="min-w-0">
        <div
          className={cn(
            "font-semibold uppercase text-sky-600",
            isHeader ? "text-[10px] tracking-[0.34em]" : "text-[9px] tracking-[0.28em]",
          )}
        >
          Jeslect
        </div>
        <div
          className={cn(
            "brand-cn-wordmark text-slate-950",
            isHeader ? "mt-1 text-[40px] leading-[0.88] tracking-[0.02em]" : "mt-1 text-[28px] leading-[0.9] tracking-[0.02em]",
          )}
        >
          婕选
        </div>
      </div>
    </div>
  );
}
