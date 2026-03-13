"use client";

import Link from "next/link";
import BrandLockup from "@/components/site/BrandLockup";
import { SUPPORT_NAV } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="border-t border-black/8 bg-white/80">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <BrandLockup tone="footer" />
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-slate-950">
              围绕适配、理解与低负担决策重建个护独立站。
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
              婕选希望把选购路径讲得更清楚一些：先看是否适合，再看怎么比较，最后把配送、退货与支持信息放到用户做决定之前。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SUPPORT_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-[13px] font-medium text-slate-700 transition hover:border-sky-200 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
