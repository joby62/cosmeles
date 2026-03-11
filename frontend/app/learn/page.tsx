import Link from "next/link";
import FeatureShell from "@/components/site/FeatureShell";
import { LEARN_TOPICS, SHOP_CONCERNS } from "@/lib/site";

export default function LearnPage() {
  return (
    <FeatureShell
      eyebrow="Learn"
      title="Build a calmer decision path before the cart gets noisy."
      summary="Jeslect Learn will eventually hold concern guides, ingredient explainers, and routine notes. The new storefront starts by teaching users how to choose with less friction and more context."
      highlights={["Concern guides", "Ingredient explainers", "Routine framing"]}
      primaryCta={{ href: "/shop", label: "Shop categories" }}
      secondaryCta={{ href: "/search", label: "Search products" }}
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          {LEARN_TOPICS.map((topic) => (
            <article key={topic.title} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
              <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">{topic.title}</h2>
              <p className="mt-3 text-[14px] leading-6 text-slate-600">{topic.summary}</p>
            </article>
          ))}
        </div>
        <div className="space-y-3">
          {SHOP_CONCERNS.map((concern) => (
            <Link key={concern.key} href={concern.href} className="block rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Concern</div>
              <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{concern.label}</h3>
              <p className="mt-2 text-[14px] leading-6 text-slate-600">{concern.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </FeatureShell>
  );
}
