import Link from "next/link";

import { BRAND } from "@/lib/brand";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";

export default function HomePage() {
  return (
    <section className="pt-10 md:pt-16">
      <div className="mx-auto flex max-w-[980px] flex-col items-center text-center">
        {/* H1：Apple-ish 大标题 */}
        <h1 className="text-[56px] leading-[1.05] tracking-[-0.03em] font-semibold md:text-[68px] lg:text-[80px]">
          {BRAND.appNameZh}
        </h1>

        {/* Slogan：保持你认可的层级（不需要加粗得像标题） */}
        <p className="mt-3 text-[19px] leading-[1.35] tracking-[-0.01em] text-black/70">
          {BRAND.slogan}
        </p>

        {/* ✅ 副文案：只替换这一行，且不加粗 */}
        <p className="mt-4 text-[19px] leading-[1.45] tracking-[-0.01em] text-black/55">
          我们替你看完所有选择，只留下真正值得用的那一个。
        </p>

        {/* Quick pills（你现有入口保留） */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {TOP_CATEGORIES.map((k) => (
            <Link
              key={k}
              href={`/c/${k}`}
              className="rounded-full border border-black/[0.10] bg-white/70 px-4 py-2 text-[12px] font-semibold tracking-[0.02em] text-black/80 hover:bg-white/90 hover:text-black transition"
            >
              {CATEGORY_CONFIG[k].zh}
            </Link>
          ))}
          <Link
            href="/compare"
            className="rounded-full border border-black/[0.10] bg-white/70 px-4 py-2 text-[12px] font-semibold tracking-[0.02em] text-black/80 hover:bg-white/90 hover:text-black transition"
          >
            横向对比
          </Link>
        </div>

        <div className="mt-16 text-[12px] tracking-[0.04em] text-black/35">
          Demo · {BRAND.appNameZh} · {BRAND.slogan}
        </div>
      </div>
    </section>
  );
}