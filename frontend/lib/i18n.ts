export type Lang = "zh" | "en";

const KEY = "matchup_lang";
const EVENT = "matchup:lang";

export function getInitialLang(): Lang {
  if (typeof window === "undefined") return "zh";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "en" || saved === "zh") return saved;
  return "zh";
}

export function setLang(next: Lang) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, next);
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
