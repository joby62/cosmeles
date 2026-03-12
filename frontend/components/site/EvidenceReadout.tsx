type EvidenceReadoutProps = {
  eyebrow: string;
  title: string;
  summary?: string | null;
  badges?: Array<string | null | undefined>;
  supportTitle: string;
  supportItems: string[];
  supportEmpty: string;
  guardrailTitle: string;
  guardrailItems: string[];
  guardrailEmpty: string;
  note?: string | null;
};

export default function EvidenceReadout({
  eyebrow,
  title,
  summary,
  badges = [],
  supportTitle,
  supportItems,
  supportEmpty,
  guardrailTitle,
  guardrailItems,
  guardrailEmpty,
  note,
}: EvidenceReadoutProps) {
  const visibleBadges = badges.map((item) => String(item || "").trim()).filter(Boolean);

  return (
    <article className="rounded-[32px] border border-black/8 bg-white/92 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
      {summary ? <p className="mt-3 text-[15px] leading-7 text-slate-600">{summary}</p> : null}

      {visibleBadges.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {visibleBadges.map((item) => (
            <span
              key={item}
              className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{supportTitle}</p>
          <div className="mt-3 space-y-2">
            {supportItems.length > 0 ? (
              supportItems.map((item) => (
                <p key={item} className="text-[14px] leading-6 text-slate-700">
                  {item}
                </p>
              ))
            ) : (
              <p className="text-[14px] leading-6 text-slate-600">{supportEmpty}</p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-700">{guardrailTitle}</p>
          <div className="mt-3 space-y-2">
            {guardrailItems.length > 0 ? (
              guardrailItems.map((item) => (
                <p key={item} className="text-[14px] leading-6 text-slate-700">
                  {item}
                </p>
              ))
            ) : (
              <p className="text-[14px] leading-6 text-slate-600">{guardrailEmpty}</p>
            )}
          </div>
        </div>
      </div>

      {note ? (
        <div className="mt-5 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Read before you act</p>
          <p className="mt-3 text-[14px] leading-6 text-slate-700">{note}</p>
        </div>
      ) : null}
    </article>
  );
}
