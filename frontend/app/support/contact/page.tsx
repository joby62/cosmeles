import Link from "next/link";
import FeatureShell from "@/components/site/FeatureShell";
import { getStorefrontPolicyCopy } from "@/lib/storefrontPolicies";
import { getSupportContactConfig, supportContactMailto } from "@/lib/supportContact";
import { getRequestSitePreferences } from "@/lib/sitePreferences.server";

export default async function ContactPage() {
  const { locale } = await getRequestSitePreferences();
  const { CONTACT_ROUTE_SECTIONS, POLICY_SCOPE_NOTE } = getStorefrontPolicyCopy(locale);
  const contact = getSupportContactConfig();
  const hasDirectChannel = Boolean(contact.email);
  const primaryCta = hasDirectChannel
    ? {
        href: supportContactMailto(contact.email || ""),
        label: locale === "zh" ? "发送邮件联系支持" : "Email support",
      }
    : { href: "/support/faq", label: locale === "zh" ? "先看常见问题" : "Read FAQ first" };
  const secondaryCta = hasDirectChannel
    ? { href: "/support/faq", label: locale === "zh" ? "先看常见问题" : "Read FAQ first" }
    : { href: "/support", label: locale === "zh" ? "返回支持中心" : "Back to support" };
  const copy =
    locale === "zh"
      ? {
          eyebrow: "联系支持",
          title: "联系路径需要明确告诉用户：当前婕选能帮什么，还不能帮什么。",
          summary: "这里定义当前独立站的支持范围。重点仍是售前清晰度，而不是支付故障或下单后的订单处理。",
          highlights: [
            "售前支持优先",
            hasDirectChannel ? "已公布直接联系通道" : "联系通道尚未公布",
            "暂不承接订单问题",
          ],
          channelTitle: "当前联系通道",
          directIntro: "当前独立站可以把售前问题直接路由到：",
          response: "响应时效",
          hours: "服务时间",
          pending: "当前版本还没有正式公布对外的直接支持通道。",
          envNote: "如需启用真实联系入口，请在前端环境中设置",
        }
      : {
          eyebrow: "Contact support",
          title: "The contact path should clearly state what Jeslect can and cannot help with right now.",
          summary: "This page defines the current support scope for the storefront. The focus is still pre-purchase clarity, not payment failures or post-order handling.",
          highlights: [
            "Pre-purchase support first",
            hasDirectChannel ? "Direct contact channel published" : "Direct channel not published yet",
            "Order support remains out of scope",
          ],
          channelTitle: "Current contact channel",
          directIntro: "The current storefront can route pre-purchase questions directly to:",
          response: "Response window",
          hours: "Support hours",
          pending: "This build does not publish a direct external support channel yet.",
          envNote: "To enable a live contact entry, set",
        };

  return (
    <FeatureShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      metaNote={POLICY_SCOPE_NOTE}
      highlights={copy.highlights}
      primaryCta={primaryCta}
      secondaryCta={secondaryCta}
    >
      <div className="space-y-4">
        <article className="rounded-[28px] border border-black/8 bg-slate-50 px-5 py-5">
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">{copy.channelTitle}</h2>
          {hasDirectChannel ? (
            <div className="mt-4 space-y-3">
              <p className="text-[14px] leading-6 text-slate-700">{copy.directIntro}</p>
              <Link
                href={supportContactMailto(contact.email || "")}
                className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[14px] font-semibold text-sky-700"
              >
                {contact.email}
              </Link>
              <div className="space-y-2">
                {contact.responseWindow ? (
                  <p className="text-[14px] leading-6 text-slate-700">{copy.response}: {contact.responseWindow}</p>
                ) : null}
                {contact.hours ? <p className="text-[14px] leading-6 text-slate-700">{copy.hours}: {contact.hours}</p> : null}
                {contact.scopeNote ? <p className="text-[14px] leading-6 text-slate-700">{contact.scopeNote}</p> : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-[14px] leading-6 text-slate-700">{copy.pending}</p>
              <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-900">
                {copy.envNote} <code>SUPPORT_EMAIL</code>。{locale === "zh" ? "可选字段包括：" : "Optional fields include:"}
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
