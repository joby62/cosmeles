"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  normalizeShampooResultQueryString,
  SHAMPOO_LAST_RESULT_QUERY_KEY,
} from "@/lib/mobile/shampooFlowStorage";

export default function ShampooRecentResultLink() {
  const [query, setQuery] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromStorage = () => {
      const stored = window.localStorage.getItem(SHAMPOO_LAST_RESULT_QUERY_KEY);
      const normalized = normalizeShampooResultQueryString(stored);
      if (!normalized) {
        window.localStorage.removeItem(SHAMPOO_LAST_RESULT_QUERY_KEY);
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
    <Link
      href={`/m/shampoo/result?${query}`}
      className="m-profile-secondary-btn inline-flex mt-3"
    >
      查看最近结果
    </Link>
  );
}
