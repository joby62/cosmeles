import type { Metadata } from "next";
import CommerceWorkbench from "@/components/site/CommerceWorkbench";
import { fetchAllProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Jeslect Ops | Commerce Workbench",
  description: "Internal commerce editor for Jeslect storefront price, inventory, shipping window, and pack size fields.",
};

export const dynamic = "force-dynamic";

export default async function CommerceOpsPage() {
  const products = await fetchAllProducts().catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <section className="rounded-[40px] border border-black/8 bg-white/92 px-5 py-8 shadow-[0_28px_72px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          Jeslect Ops
        </div>
        <h1 className="site-display mt-5 text-[42px] leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[56px]">
          Commerce workbench for the US storefront.
        </h1>
        <p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-600">
          This route is for internal feed operations. Use it to patch price, inventory, shipping window, and pack size
          into products without falling back to raw API calls.
        </p>
      </section>

      <section className="mt-10">
        <CommerceWorkbench initialProducts={products} />
      </section>
    </div>
  );
}
