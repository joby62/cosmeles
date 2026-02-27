import Link from "next/link";

export default function ShampooStart() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-black/90">洗发水 · 浴室里的最终答案</div>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        我们用 3 个问题快速判断：先看出油节奏，再看头皮状态，再看发丝受损。
      </p>
      <p className="mt-2 text-[14px] leading-[1.5] text-black/45">
        有头屑痒或发红刺痛会直接快路径出结果，不让你多答题。
      </p>

      <div className="mt-7">
        <Link
          href="/m/shampoo/profile?step=1"
          className="inline-flex h-11 items-center justify-center rounded-full bg-black/90 px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:bg-black"
        >
          开始判断
        </Link>
      </div>
    </div>
  );
}
