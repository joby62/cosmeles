import Link from "next/link";
import LotionRecentResultLink from "./recent-result-link";

export default function LotionStart() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-[color:var(--m-text)]">润肤霜 · 浴室的最终答案</div>
      <p className="mt-3 text-[15px] leading-[1.55] text-[color:var(--m-profile-note)]">
        用 5 个问题做矩阵决策：环境、耐受、核心痛点、质地偏好、特殊限制。系统只给一个最终类别。
      </p>
      <p className="mt-2 text-[14px] leading-[1.5] text-[color:var(--m-profile-meta)]">触发敏感/致痘/孕哺防线时，会自动启用掩码过滤风险路线。</p>

      <div className="mt-7">
        <Link href="/m/lotion/profile?step=1" className="m-profile-primary-btn inline-flex h-11 items-center justify-center px-5 text-[15px] font-semibold tracking-[-0.01em]">
          开始判断
        </Link>
        <div>
          <LotionRecentResultLink />
        </div>
      </div>
    </div>
  );
}
