import Link from "next/link";

export default function ShampooStart() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-black/90">
        洗发水 · 浴室的最终的答案
      </div>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        你不需要懂成分。用 4 个自然问题收齐信号，我们直接拍板，不给你备选项。
      </p>
      <p className="mt-2 text-[14px] leading-[1.5] text-black/45">全程约 30 秒，一步只做一件事。</p>

      <div className="mt-7">
        <Link
          href="/m/shampoo/profile?step=1"
          className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] font-semibold tracking-[-0.01em] text-white bg-black/90 active:bg-black"
        >
          开始
        </Link>
      </div>
    </div>
  );
}
