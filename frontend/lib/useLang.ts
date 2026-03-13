"use client";

import { useEffect, useState } from "react";
import { getInitialLang, subscribeLang, type Lang } from "@/lib/i18n";

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>(() => getInitialLang());

  useEffect(() => {
    return subscribeLang(() => {
      setLang(getInitialLang());
    });
  }, []);

  return lang;
}
