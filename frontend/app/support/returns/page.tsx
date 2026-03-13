import FeatureShell from "@/components/site/FeatureShell";
import { POLICY_SCOPE_NOTE, RETURNS_POLICY_SECTIONS } from "@/lib/storefrontPolicies";

export default function ReturnsPage() {
  return (
    <FeatureShell
      eyebrow="退货"
      title="退货规则应该降低犹豫，而不是制造新的担心。"
      summary="这里定义婕选当前独立站的退货基线：哪些内容今天就该能读懂，退货信任如何嵌进商品和袋中的决策链路，以及哪些部分仍依赖后续运营落地。"
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["时限前置", "条件直白", "例外不隐藏"]}
      primaryCta={{ href: "/support", label: "返回支持中心" }}
      secondaryCta={{ href: "/support/contact", label: "联系支持" }}
    >
      <div className="space-y-4">
        {RETURNS_POLICY_SECTIONS.map((section) => (
          <article key={section.title} className="rounded-[28px] border border-black/8 bg-slate-50 px-5 py-5">
            <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">{section.title}</h2>
            <div className="mt-4 space-y-2">
              {section.items.map((item) => (
                <p key={item} className="text-[14px] leading-6 text-slate-700">
                  {item}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </FeatureShell>
  );
}
