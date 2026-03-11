import FeatureShell from "@/components/site/FeatureShell";

const termsPoints = [
  "Storefront terms should stay easy to find from every bag and support path.",
  "Commercial rules, if any, should be written in customer-readable sections.",
  "The final legal copy will align with the public launch scope of the US storefront.",
];

export default function TermsPage() {
  return (
    <FeatureShell
      eyebrow="Terms"
      title="Terms should be visible and understandable before checkout matters."
      summary="The new Jeslect storefront is reserving a dedicated terms route now so the launch stack does not treat legal clarity as an afterthought."
      highlights={["Visible terms path", "Readable sections", "US launch scope"]}
      primaryCta={{ href: "/privacy", label: "Privacy page" }}
      secondaryCta={{ href: "/support/faq", label: "Support FAQ" }}
    >
      <div className="space-y-3">
        {termsPoints.map((item) => (
          <article key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
            {item}
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
