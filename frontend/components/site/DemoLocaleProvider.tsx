"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type DemoLocale = "en" | "zh";

type DemoLocaleContextValue = {
  locale: DemoLocale;
  setLocale: (locale: DemoLocale) => void;
};

const STORAGE_KEY = "jeslect-demo-locale";

const DemoLocaleContext = createContext<DemoLocaleContextValue | null>(null);

function applyLocaleToDocument(locale: DemoLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.demoLocale = locale;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en-US";
}

function readStoredLocale(): DemoLocale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "zh" ? "zh" : "en";
}

export default function DemoLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<DemoLocale>(() => readStoredLocale());

  useEffect(() => {
    applyLocaleToDocument(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: DemoLocale) => {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    }
    applyLocaleToDocument(nextLocale);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale],
  );

  return <DemoLocaleContext.Provider value={value}>{children}</DemoLocaleContext.Provider>;
}

export function useDemoLocale(): DemoLocaleContextValue {
  const context = useContext(DemoLocaleContext);
  if (!context) {
    throw new Error("useDemoLocale must be used inside DemoLocaleProvider.");
  }
  return context;
}
