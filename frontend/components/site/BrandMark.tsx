import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  tone?: "header" | "footer";
};

export default function BrandMark({ size = 52, tone = "header" }: BrandMarkProps) {
  const markSize = tone === "header" ? Math.round(size * 0.52) : Math.round(size * 0.54);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[20px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,246,251,0.95)_100%)] shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(41,151,255,0.12),transparent_54%)]" />
      <div className="relative z-10 flex h-full items-center justify-center text-slate-950">
        <div className="relative" style={{ width: markSize, height: markSize }}>
          <Image
            src="/jeslect-brand-mark.svg"
            alt="婕选品牌图形标"
            fill
            sizes={`${markSize}px`}
            className="translate-y-px object-contain object-center"
          />
        </div>
      </div>
    </div>
  );
}
