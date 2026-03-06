import Link from "next/link";
import ConditionerRecentResultLink from "./recent-result-link";

export default function ConditionerStart() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-[color:var(--m-text)]">
        护发素 · 浴室的最终答案
      </div>
      <p className="mt-3 text-[15px] leading-[1.55] text-[color:var(--m-profile-note)]">
        不用研究参数。用 3 个自然问题收齐信号，按矩阵+掩码直接收敛，只给你一个答案。
      </p>
      <p className="mt-2 text-[14px] leading-[1.5] text-[color:var(--m-profile-meta)]">全程约 30 秒，一步只做一件事。</p>

      <div className="mt-7">
        <Link href="/m/conditioner/profile?step=1" className="m-profile-primary-btn inline-flex h-11 items-center justify-center px-5 text-[15px] font-semibold tracking-[-0.01em]">
          开始
        </Link>
        <div>
          <ConditionerRecentResultLink />
        </div>
      </div>
    </div>
  );
}
