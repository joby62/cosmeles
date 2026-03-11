import FeatureShell from "@/components/site/FeatureShell";

const cookiePoints = [
  "Necessary storefront state should remain separate from optional analytics choices.",
  "Cookie choices should be visible and revisitable from the support footer.",
  "Consent language should stay readable on mobile first, not only on desktop popups.",
];

export default function CookiesPage() {
  return (
    <FeatureShell
      eyebrow="Cookies"
      title="Cookie choices should feel understandable on the first read."
      summary="Jeslect will separate necessary storefront state from optional tracking choices so the consent layer stays clearer for US users and future regional expansion."
      highlights={["Necessary vs optional", "Revisitable choices", "Mobile-readable consent"]}
      primaryCta={{ href: "/privacy", label: "Privacy page" }}
      secondaryCta={{ href: "/shop", label: "Back to shop" }}
    >
      <div className="space-y-3">
        {cookiePoints.map((item) => (
          <article key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
            {item}
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
