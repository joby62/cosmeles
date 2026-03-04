import Link from "next/link";

export default function MobileAboutPage() {
  return (
    <section className="space-y-5 pb-8">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">关于我们</h1>
      <p className="mt-3 text-[15px] leading-[1.6] text-black/62">
        予选只做一件事：把洗护决策从“反复比较”变成“直接放心用”。
      </p>

      <Link
        href="/m/git"
        className="block rounded-3xl border border-black/10 bg-white/90 p-4 shadow-[0_10px_24px_rgba(17,24,39,0.08)] dark:border-white/15 dark:bg-white/6"
      >
        <p className="text-[12px] tracking-[0.11em] text-black/48 uppercase dark:text-white/52">Git Pulse</p>
        <h2 className="mt-1 text-[18px] leading-[1.24] font-semibold tracking-[-0.015em] text-black/88 dark:text-white/92">
          查看新增/删除代码流
        </h2>
        <p className="mt-1 text-[13px] leading-[1.55] text-black/58 dark:text-white/62">
          用真实 git 历史看近 30 天代码增删趋势、模块贡献和高波动提交。
        </p>
      </Link>
    </section>
  );
}
