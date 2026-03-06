import Link from "next/link";

export default function CleanserStart() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-black/90">洗面奶 · 浴室的最终答案</div>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        用 5 个问题做矩阵决策：出油、敏感、清洁负担、特殊痛点、肤感偏好。系统只给一个最终类别。
      </p>
      <p className="mt-2 text-[14px] leading-[1.5] text-black/45">当触发敏感/破口/极干防线时，会自动启用掩码保护。</p>

      <div className="mt-7">
        <Link
          href="/m/cleanser/profile?step=1"
          className="inline-flex h-11 items-center justify-center rounded-full bg-black/90 px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:bg-black"
        >
          开始判断
        </Link>
      </div>
    </div>
  );
}
