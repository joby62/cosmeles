"use client";

import { useEffect, useRef } from "react";
import { trackMobileEvent } from "@/lib/mobileAnalytics";

type Props = {
  page: string;
  route: string;
  source?: string;
  category?: string | null;
  productId?: string | null;
  userProductId?: string | null;
  compareId?: string | null;
  extra?: Record<string, unknown>;
  thresholds?: number[];
};

function computeDepthPercent(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const doc = document.documentElement;
  const body = document.body;
  const viewportBottom = (window.scrollY || doc.scrollTop || 0) + window.innerHeight;
  const totalHeight = Math.max(doc.scrollHeight, body.scrollHeight, window.innerHeight);
  if (totalHeight <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((viewportBottom / totalHeight) * 100)));
}

export default function MobileScrollDepthAnalytics({
  page,
  route,
  source,
  category,
  productId,
  userProductId,
  compareId,
  extra,
  thresholds = [25, 50, 75, 100],
}: Props) {
  const firedRef = useRef<Set<number>>(new Set());
  const latestRouteRef = useRef(route);
  const latestExtraRef = useRef<Record<string, unknown>>(extra || {});

  useEffect(() => {
    latestRouteRef.current = route;
    latestExtraRef.current = extra || {};
  }, [extra, route]);

  useEffect(() => {
    firedRef.current = new Set();

    const emitDepth = () => {
      const depth = computeDepthPercent();
      for (const threshold of thresholds) {
        if (depth < threshold || firedRef.current.has(threshold)) continue;
        firedRef.current.add(threshold);
        void trackMobileEvent("scroll_depth", {
          page,
          route: latestRouteRef.current,
          source: source || undefined,
          category: category || undefined,
          product_id: productId || undefined,
          user_product_id: userProductId || undefined,
          compare_id: compareId || undefined,
          depth_percent: threshold,
          max_depth_percent: depth,
          ...latestExtraRef.current,
        });
      }
    };

    emitDepth();
    window.addEventListener("scroll", emitDepth, { passive: true });
    window.addEventListener("resize", emitDepth);
    return () => {
      window.removeEventListener("scroll", emitDepth);
      window.removeEventListener("resize", emitDepth);
    };
  }, [category, compareId, page, productId, route, source, thresholds, userProductId]);

  return null;
}
