import FeatureShell from "@/components/site/FeatureShell";

export default function AboutPage() {
  return (
    <FeatureShell
      eyebrow="About Jeslect"
      title="Jeslect is building a beauty storefront around clarity before conversion."
      summary="The new brand layer is intentionally calmer: fewer claims, more routine fit, lower information density, and clearer product reasoning. The goal is not to overwhelm users into checkout. The goal is to help them choose with less friction."
      highlights={["Clarity over clutter", "Routine fit before hype", "Ingredient transparency as trust"]}
      primaryCta={{ href: "/shop", label: "Shop Jeslect" }}
      secondaryCta={{ href: "/support/faq", label: "Read FAQ" }}
    />
  );
}
