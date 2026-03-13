"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_SITE_PREFERENCES,
  SITE_LOCALE_COOKIE,
  SITE_PREFERENCE_MAX_AGE,
  getDocumentLang,
  normalizeSiteLocale,
  type SiteLocale,
} from "@/lib/sitePreferences";

type SitePreferenceContextValue = {
  locale: SiteLocale;
  setLocale: (locale: SiteLocale) => void;
};

const SitePreferenceContext = createContext<SitePreferenceContextValue | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Max-Age=${SITE_PREFERENCE_MAX_AGE}; Path=/; SameSite=Lax`;
}

function applyDocumentLocale(locale: SiteLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = getDocumentLang(locale);
  document.documentElement.dataset.siteLocale = locale;
}

export default function SitePreferenceProvider({
  children,
  initialLocale = DEFAULT_SITE_PREFERENCES.locale,
}: {
  children: React.ReactNode;
  initialLocale?: SiteLocale;
}) {
  const [locale, setLocaleState] = useState<SiteLocale>(initialLocale);

  useEffect(() => {
    setLocaleState(normalizeSiteLocale(initialLocale));
  }, [initialLocale]);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  function setLocale(nextLocale: SiteLocale) {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SITE_LOCALE_COOKIE, nextLocale);
    }
    writeCookie(SITE_LOCALE_COOKIE, nextLocale);
    applyDocumentLocale(nextLocale);
  }

  return (
    <SitePreferenceContext.Provider
      value={{
        locale,
        setLocale,
      }}
    >
      {children}
    </SitePreferenceContext.Provider>
  );
}

export function useSitePreferences(): SitePreferenceContextValue {
  const context = useContext(SitePreferenceContext);
  if (!context) {
    throw new Error("useSitePreferences must be used inside SitePreferenceProvider.");
  }
  return context;
}
