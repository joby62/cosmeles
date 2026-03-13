import { cookies, headers } from "next/headers";
import type { Lang } from "@/lib/i18n";
import { LANG_COOKIE_KEY } from "@/lib/i18n";

function normalizeLang(raw: unknown): Lang | null {
  return raw === "en" || raw === "zh" ? raw : null;
}

export async function getServerLang(): Promise<Lang> {
  try {
    const cookieStore = await cookies();
    const cookieLang = normalizeLang(cookieStore.get(LANG_COOKIE_KEY)?.value);
    if (cookieLang) return cookieLang;
  } catch {
    // Fall through to headers.
  }

  try {
    const headerStore = await headers();
    return String(headerStore.get("accept-language") || "").toLowerCase().startsWith("en") ? "en" : "zh";
  } catch {
    return "zh";
  }
}
