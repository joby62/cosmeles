import FeatureShell from "@/components/site/FeatureShell";

const privacyPoints = [
  "Privacy choices should be readable, not buried in dense legal language.",
  "Cookie and data handling notices need explicit user-facing surfaces.",
  "US privacy expectations are the first baseline for the new storefront.",
];

export default function PrivacyPage() {
  return (
    <FeatureShell
      eyebrow="Privacy"
      title="Privacy pages should explain customer rights in plain language."
      summary="Jeslect will publish a cleaner privacy experience for the US launch, including the data paths that matter most to storefront browsing, saved bags, and support."
      highlights={["Readable privacy copy", "Visible data choices", "US baseline first"]}
      primaryCta={{ href: "/cookies", label: "Cookie choices" }}
      secondaryCta={{ href: "/support/contact", label: "Contact support" }}
    >
      <div className="space-y-3">
        {privacyPoints.map((item) => (
          <article key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
            {item}
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
