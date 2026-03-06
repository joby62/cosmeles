"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BODYWASH_LAST_RESULT_QUERY_KEY,
  normalizeBodyWashResultQueryString,
} from "@/lib/mobile/bodywashFlowStorage";

export default function BodyWashRecentResultLink() {
  const [query, setQuery] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromStorage = () => {
      const stored = window.localStorage.getItem(BODYWASH_LAST_RESULT_QUERY_KEY);
      const normalized = normalizeBodyWashResultQueryString(stored);
      if (!normalized) {
        window.localStorage.removeItem(BODYWASH_LAST_RESULT_QUERY_KEY);
        setQuery((prev) => (prev === null ? prev : null));
        return;
      }
      setQuery((prev) => (prev === normalized ? prev : normalized));
    };

    const rafId = window.requestAnimationFrame(syncFromStorage);
    window.addEventListener("focus", syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("focus", syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  if (!query) return null;

  return (
    <Link href={`/m/bodywash/result?${query}`} className="m-profile-secondary-btn inline-flex mt-3">
      查看最近结果
    </Link>
  );
}
