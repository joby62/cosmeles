export type Lang = "zh" | "en";

export const LANG_STORAGE_KEY = "matchup_lang";
export const LANG_COOKIE_KEY = "matchup_lang";
const EVENT = "matchup:lang";

function normalizeLang(raw: unknown): Lang | null {
  return raw === "en" || raw === "zh" ? raw : null;
}

function readCookieLang(): Lang | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${LANG_COOKIE_KEY}=`));
  if (!cookie) return null;
  return normalizeLang(cookie.slice(LANG_COOKIE_KEY.length + 1));
}

function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "zh";
  return String(navigator.language || "").toLowerCase().startsWith("en") ? "en" : "zh";
}

export function getInitialLang(): Lang {
  if (typeof window === "undefined") return "zh";
  const saved = normalizeLang(window.localStorage.getItem(LANG_STORAGE_KEY));
  if (saved) return saved;
  const cookie = readCookieLang();
  if (cookie) return cookie;
  return detectBrowserLang();
}

export function setLang(next: Lang) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_STORAGE_KEY, next);
  document.cookie = `${LANG_COOKIE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function subscribeLang(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const on = () => cb();
  window.addEventListener(EVENT, on as EventListener);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(EVENT, on as EventListener);
    window.removeEventListener("storage", on);
  };
}

/** 轻量取词：保证同屏只出一种语言 */
export function pickLang<T>(lang: Lang, zh: T, en: T): T {
  return lang === "zh" ? zh : en;
}
