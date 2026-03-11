type TrustStripProps = {
  items: string[];
  className?: string;
};

export default function TrustStrip({ items, className = "" }: TrustStripProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
