import Link from "next/link";

export default function BodyWashStart() {
  return (
    <div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-black/90">沐浴露 · 浴室里的最终答案</div>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        用 5 个自然问题收敛：环境、耐受、油脂角质、冲洗偏好、特殊限制。系统只给一个最终类别。
      </p>
      <p className="mt-2 text-[14px] leading-[1.5] text-black/45">如果你选到“极度敏感”，会触发安全优先快路径，直接出结果卡。</p>

      <div className="mt-7">
        <Link
          href="/m/bodywash/profile?step=1"
          className="inline-flex h-11 items-center justify-center rounded-full bg-black/90 px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:bg-black"
        >
          开始判断
        </Link>
      </div>
    </div>
  );
}
