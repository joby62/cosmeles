import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  tone?: "header" | "footer";
};

export default function BrandMark({ size = 52, tone = "header" }: BrandMarkProps) {
  const inset = tone === "header" ? 14 : 12;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[20px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,246,251,0.95)_100%)] shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(41,151,255,0.12),transparent_54%)]" />
      <div className="absolute inset-0 relative text-slate-950" style={{ padding: inset }}>
        <Image
          src="/jeslect-brand-mark.svg"
          alt="Jeslect brand mark"
          fill
          className="object-contain"
          sizes={`${size}px`}
        />
      </div>
    </div>
  );
}
