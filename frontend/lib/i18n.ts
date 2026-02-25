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
  window.addEventListener(EVENT, on as any);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(EVENT, on as any);
    window.removeEventListener("storage", on);
  };
}

/** 轻量取词：保证同屏只出一种语言 */
export function pickLang<T>(lang: Lang, zh: T, en: T): T {
  return lang === "zh" ? zh : en;
}

/** Client hook：不引入状态机，只基于 subscribeLang 做同步 */
export function useLang(): [Lang, (next: Lang) => void] {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const React = require("react") as typeof import("react");
  const [lang, setState] = React.useState<Lang>(() => getInitialLang());

  React.useEffect(() => {
    return subscribeLang(() => setState(getInitialLang()));
  }, []);

  const set = React.useCallback((next: Lang) => {
    setLang(next);
    setState(next);
  }, []);

  return [lang, set];
}