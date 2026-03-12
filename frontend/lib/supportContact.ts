export type SupportContactConfig = {
  email: string | null;
  responseWindow: string | null;
  hours: string | null;
  scopeNote: string | null;
};

function clean(value: string | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

export function getSupportContactConfig(): SupportContactConfig {
  return {
    email: clean(process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
    responseWindow: clean(process.env.SUPPORT_RESPONSE_WINDOW || process.env.NEXT_PUBLIC_SUPPORT_RESPONSE_WINDOW),
    hours: clean(process.env.SUPPORT_HOURS || process.env.NEXT_PUBLIC_SUPPORT_HOURS),
    scopeNote: clean(process.env.SUPPORT_SCOPE_NOTE || process.env.NEXT_PUBLIC_SUPPORT_SCOPE_NOTE),
  };
}

export function supportContactMailto(email: string): string {
  const subject = encodeURIComponent("Jeslect support question");
  return `mailto:${email}?subject=${subject}`;
}
