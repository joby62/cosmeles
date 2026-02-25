export type Lang = "zh" | "en";

const KEY = "matchup_lang";

export function getInitialLang(): Lang {
  if (typeof window === "undefined") return "zh";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "en" || saved === "zh") return saved;
  return "zh";
}

export function setLang(next: Lang) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, next);
  window.dispatchEvent(new CustomEvent("matchup:lang", { detail: next }));
}

export function subscribeLang(cb: () => void) {
  const on = () => cb();
  window.addEventListener("matchup:lang", on as any);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener("matchup:lang", on as any);
    window.removeEventListener("storage", on);
  };
}