import FeatureShell from "@/components/site/FeatureShell";
import { POLICY_SCOPE_NOTE, TERMS_SECTIONS } from "@/lib/storefrontPolicies";

export default function TermsPage() {
  return (
    <FeatureShell
      eyebrow="条款"
      title="使用条款应该对应站点真实范围，而不是假想中已经完整的商城。"
      summary="这些条款描述的是当前婕选独立站已经存在的能力：发现、适配、对比、探索、已存 shortlist 行为，以及支付开放前的公开政策内容。"
      metaNote={POLICY_SCOPE_NOTE}
      highlights={["只对应当前范围", "袋中不是订单", "规则表达可读"]}
      primaryCta={{ href: "/privacy", label: "查看隐私说明" }}
      secondaryCta={{ href: "/support", label: "返回支持中心" }}
    >
      <div className="space-y-4">
        {TERMS_SECTIONS.map((section) => (
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
