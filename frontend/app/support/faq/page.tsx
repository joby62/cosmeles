import FeatureShell from "@/components/site/FeatureShell";

const faq = [
  {
    question: "How is Jeslect choosing which products to show first?",
    answer: "The current storefront prioritizes product profiles that already have clearer routine, ingredient, and fit data available.",
  },
  {
    question: "Can I save products before checkout is live?",
    answer: "Yes. The current bag acts as a saved shortlist while checkout and pricing layers are rebuilt.",
  },
  {
    question: "Where will shipping and returns live?",
    answer: "Shipping and returns pages are first-class support routes so users can find them before they commit to a product.",
  },
];

export default function FaqPage() {
  return (
    <FeatureShell
      eyebrow="FAQ"
      title="Put the common questions in front of the customer early."
      summary="Jeslect FAQ is being structured around shopping confidence: product fit, bag behavior, shipping visibility, and return clarity."
      highlights={["Shopping confidence", "Bag behavior", "Support visibility"]}
      primaryCta={{ href: "/shop", label: "Go to shop" }}
      secondaryCta={{ href: "/support/contact", label: "Contact support" }}
    >
      <div className="space-y-3">
        {faq.map((item) => (
          <article key={item.question} className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{item.question}</h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">{item.answer}</p>
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
