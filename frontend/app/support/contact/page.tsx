import FeatureShell from "@/components/site/FeatureShell";

const supportBlocks = [
  "Launch contact channels will live here as part of the public support stack.",
  "Response expectations should be visible before customers submit a request.",
  "Order, product, and returns help will be separated so support paths stay clearer.",
];

export default function ContactPage() {
  return (
    <FeatureShell
      eyebrow="Contact"
      title="Support contact belongs inside the storefront trust layer."
      summary="Jeslect contact paths are being rebuilt alongside the storefront so users can see how support works before they ever place an order."
      highlights={["Visible support path", "Response expectations", "Lower-friction help routing"]}
      primaryCta={{ href: "/support/faq", label: "Read FAQ first" }}
      secondaryCta={{ href: "/shop", label: "Back to shop" }}
    >
      <div className="space-y-3">
        {supportBlocks.map((item) => (
          <article key={item} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 text-[14px] leading-6 text-slate-700">
            {item}
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
