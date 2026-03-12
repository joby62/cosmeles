"use client";

import { useEffect, useRef } from "react";
import { trackMobileEventWithBeacon } from "@/lib/mobileAnalytics";

type Props = {
  eventName: string;
  page: string;
  route: string;
  source?: string;
  category?: string | null;
  productId?: string | null;
  userProductId?: string | null;
  compareId?: string | null;
  extra?: Record<string, unknown>;
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

export default function MobileLeaveEventAnalytics({
  eventName,
  page,
  route,
  source,
  category,
  productId,
  userProductId,
  compareId,
  extra,
}: Props) {
  const startedAtRef = useRef<number>(0);
  const maxDepthRef = useRef<number>(0);
  const latestRouteRef = useRef(route);
  const latestExtraRef = useRef<Record<string, unknown>>(extra || {});
  const exitedRef = useRef(false);

  useEffect(() => {
    latestRouteRef.current = route;
    latestExtraRef.current = extra || {};
  }, [extra, route]);

  useEffect(() => {
    exitedRef.current = false;
    startedAtRef.current = Date.now();
    maxDepthRef.current = computeDepthPercent();

    const captureDepth = () => {
      maxDepthRef.current = Math.max(maxDepthRef.current, computeDepthPercent());
    };

    const emitLeave = (exitType: string) => {
      if (exitedRef.current) return;
      exitedRef.current = true;
      captureDepth();
      trackMobileEventWithBeacon(eventName, {
        page,
        route: latestRouteRef.current,
        source: source || undefined,
        category: category || undefined,
        product_id: productId || undefined,
        user_product_id: userProductId || undefined,
        compare_id: compareId || undefined,
        dwell_ms: Date.now() - startedAtRef.current,
        max_depth_percent: maxDepthRef.current,
        exit_type: exitType,
        ...latestExtraRef.current,
      });
    };

    const onPageHide = () => emitLeave("pagehide");
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") emitLeave("hidden");
    };

    window.addEventListener("scroll", captureDepth, { passive: true });
    window.addEventListener("resize", captureDepth);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      emitLeave("unmount");
      window.removeEventListener("scroll", captureDepth);
      window.removeEventListener("resize", captureDepth);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [category, compareId, eventName, page, productId, route, source, userProductId]);

  return null;
}
