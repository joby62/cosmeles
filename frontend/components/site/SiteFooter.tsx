import Link from "next/link";
import { SUPPORT_NAV } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="border-t border-black/8 bg-white/80">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600">Jeslect</div>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-slate-950">
              English-first storefront, built for a calmer US decision flow.
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
              Jeslect is rebuilding the product journey around clearer routine fit, cleaner comparison, and lower-friction
              product discovery.
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
