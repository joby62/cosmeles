import Link from "next/link";
import FeatureShell from "@/components/site/FeatureShell";
import { CONTACT_ROUTE_SECTIONS, POLICY_SCOPE_NOTE } from "@/lib/storefrontPolicies";
import { getSupportContactConfig, supportContactMailto } from "@/lib/supportContact";

export default function ContactPage() {
  const contact = getSupportContactConfig();
  const hasDirectChannel = Boolean(contact.email);
  const primaryCta = hasDirectChannel
    ? { href: supportContactMailto(contact.email || ""), label: "发送邮件联系支持" }
    : { href: "/support/faq", label: "先看常见问题" };
  const secondaryCta = hasDirectChannel
    ? { href: "/support/faq", label: "先看常见问题" }
    : { href: "/support", label: "返回支持中心" };

  return (
    <FeatureShell
      eyebrow="联系支持"
      title="联系路径需要明确告诉用户：当前婕选能帮什么，还不能帮什么。"
      summary="这里定义当前独立站的支持范围。重点仍是售前清晰度，而不是支付故障或下单后的订单处理。"
      metaNote={POLICY_SCOPE_NOTE}
      highlights={[
        "售前支持优先",
        hasDirectChannel ? "已公布直接联系通道" : "联系通道尚未公布",
        "暂不承接订单问题",
      ]}
      primaryCta={primaryCta}
      secondaryCta={secondaryCta}
    >
      <div className="space-y-4">
        <article className="rounded-[28px] border border-black/8 bg-slate-50 px-5 py-5">
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">当前联系通道</h2>
          {hasDirectChannel ? (
            <div className="mt-4 space-y-3">
              <p className="text-[14px] leading-6 text-slate-700">
                当前独立站可以把售前问题直接路由到：
              </p>
              <Link
                href={supportContactMailto(contact.email || "")}
                className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[14px] font-semibold text-sky-700"
              >
                {contact.email}
              </Link>
              <div className="space-y-2">
                {contact.responseWindow ? (
                  <p className="text-[14px] leading-6 text-slate-700">响应时效：{contact.responseWindow}</p>
                ) : null}
                {contact.hours ? <p className="text-[14px] leading-6 text-slate-700">服务时间：{contact.hours}</p> : null}
                {contact.scopeNote ? <p className="text-[14px] leading-6 text-slate-700">{contact.scopeNote}</p> : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-[14px] leading-6 text-slate-700">
                当前版本还没有正式公布对外的直接支持通道。
              </p>
              <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-900">
                如需启用真实联系入口，请在前端环境中设置 <code>SUPPORT_EMAIL</code>。可选字段包括：
                <code> SUPPORT_RESPONSE_WINDOW</code>、<code>SUPPORT_HOURS</code>、<code>SUPPORT_SCOPE_NOTE</code>。
              </p>
            </div>
          )}
        </article>

        {CONTACT_ROUTE_SECTIONS.map((section) => (
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
