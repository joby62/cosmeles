"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CLEANSER_LAST_RESULT_QUERY_KEY,
  normalizeCleanserResultQueryString,
} from "@/lib/mobile/cleanserFlowStorage";

export default function CleanserRecentResultLink() {
  const [query, setQuery] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromStorage = () => {
      const stored = window.localStorage.getItem(CLEANSER_LAST_RESULT_QUERY_KEY);
      const normalized = normalizeCleanserResultQueryString(stored);
      if (!normalized) {
        window.localStorage.removeItem(CLEANSER_LAST_RESULT_QUERY_KEY);
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
    <Link href={`/m/cleanser/result?${query}`} className="m-profile-secondary-btn inline-flex mt-3">
      查看最近结果
    </Link>
  );
}
