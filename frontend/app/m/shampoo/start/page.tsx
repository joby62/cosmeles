import Link from "next/link";
import ShampooRecentResultLink from "./recent-result-link";

export default function ShampooStart() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-[color:var(--m-text)]">洗发水 · 浴室里的最终答案</div>
      <p className="mt-3 text-[15px] leading-[1.55] text-[color:var(--m-profile-note)]">
        我们用 3 个问题快速判断：先看出油节奏，再看头皮状态，再看发丝受损。
      </p>
      <p className="mt-2 text-[14px] leading-[1.5] text-[color:var(--m-profile-meta)]">
        有头屑痒或发红刺痛会直接快路径出结果，不让你多答题。
      </p>

      <div className="mt-7">
        <Link href="/m/shampoo/profile?step=1" className="m-profile-primary-btn inline-flex h-11 items-center justify-center px-5 text-[15px] font-semibold tracking-[-0.01em]">
          开始判断
        </Link>
        <div>
          <ShampooRecentResultLink />
        </div>
      </div>
    </div>
  );
}
