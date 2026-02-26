import Link from "next/link";

export default function ShampooStart() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-black/90">
        洗发水 · 快速定位
      </div>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        你不需要懂成分。回答几个简单问题，我直接给出唯一主推。
      </p>

      <div className="mt-7">
        <Link
          href="/m/shampoo/profile"
          className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] font-semibold tracking-[-0.01em] text-white bg-black/90 active:bg-black"
        >
          开始
        </Link>
      </div>
    </div>
  );
}