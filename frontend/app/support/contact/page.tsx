import Link from "next/link";
import FeatureShell from "@/components/site/FeatureShell";
import { CONTACT_ROUTE_SECTIONS, POLICY_SCOPE_NOTE } from "@/lib/storefrontPolicies";
import { getSupportContactConfig, supportContactMailto } from "@/lib/supportContact";

export default function ContactPage() {
  const contact = getSupportContactConfig();
  const hasDirectChannel = Boolean(contact.email);
  const primaryCta = hasDirectChannel
    ? { href: supportContactMailto(contact.email || ""), label: "Email Jeslect support" }
    : { href: "/support/faq", label: "Read FAQ first" };
  const secondaryCta = hasDirectChannel
    ? { href: "/support/faq", label: "Read FAQ first" }
    : { href: "/support", label: "Support hub" };

  return (
    <FeatureShell
      eyebrow="Contact"
      title="Contact routing should stay clear about what Jeslect can and cannot support today."
      summary="This page defines the support scope for the current US storefront. It is focused on pre-purchase clarity, not live payment or post-order operations."
      metaNote={POLICY_SCOPE_NOTE}
      highlights={[
        "Pre-purchase support",
        hasDirectChannel ? "Direct contact live" : "Channel not published yet",
        "No order help yet",
      ]}
      primaryCta={primaryCta}
      secondaryCta={secondaryCta}
    >
      <div className="space-y-4">
        <article className="rounded-[28px] border border-black/8 bg-slate-50 px-5 py-5">
          <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-slate-950">Current contact channel</h2>
          {hasDirectChannel ? (
            <div className="mt-4 space-y-3">
              <p className="text-[14px] leading-6 text-slate-700">
                The current US storefront can route pre-purchase questions directly to:
              </p>
              <Link
                href={supportContactMailto(contact.email || "")}
                className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[14px] font-semibold text-sky-700"
              >
                {contact.email}
              </Link>
              <div className="space-y-2">
                {contact.responseWindow ? (
                  <p className="text-[14px] leading-6 text-slate-700">Response window: {contact.responseWindow}</p>
                ) : null}
                {contact.hours ? <p className="text-[14px] leading-6 text-slate-700">Coverage hours: {contact.hours}</p> : null}
                {contact.scopeNote ? <p className="text-[14px] leading-6 text-slate-700">{contact.scopeNote}</p> : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-[14px] leading-6 text-slate-700">
                A direct support channel has not been published in this storefront build yet.
              </p>
              <p className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-900">
                To enable this page, set <code>SUPPORT_EMAIL</code> in the frontend environment. Optional fields:
                <code> SUPPORT_RESPONSE_WINDOW</code>, <code>SUPPORT_HOURS</code>, <code>SUPPORT_SCOPE_NOTE</code>.
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
