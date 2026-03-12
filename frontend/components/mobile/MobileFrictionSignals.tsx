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
  stallAfterMs?: number;
  extra?: Record<string, unknown>;
};

const RAGE_CLICK_WINDOW_MS = 1800;
const RAGE_CLICK_THRESHOLD = 3;

function findAnalyticsTargetId(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest("[data-analytics-id]");
  const value = node?.getAttribute("data-analytics-id");
  return value?.trim() || null;
}

export default function MobileFrictionSignals({
  page,
  route,
  source,
  category,
  productId,
  userProductId,
  compareId,
  stallAfterMs = 18000,
  extra,
}: Props) {
  const startedAtRef = useRef<number>(0);
  const lastActivityAtRef = useRef<number>(0);
  const stallTimerRef = useRef<number | null>(null);
  const stallFiredRef = useRef(false);
  const lastClickTargetRef = useRef<string | null>(null);
  const lastClickAtRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);
  const rageFiredTargetsRef = useRef<Set<string>>(new Set());
  const latestRouteRef = useRef(route);
  const latestExtraRef = useRef<Record<string, unknown>>(extra || {});

  useEffect(() => {
    latestRouteRef.current = route;
    latestExtraRef.current = extra || {};
  }, [extra, route]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    lastActivityAtRef.current = Date.now();
    stallFiredRef.current = false;
    rageFiredTargetsRef.current = new Set();
    lastClickTargetRef.current = null;
    clickCountRef.current = 0;

    const clearStallTimer = () => {
      if (stallTimerRef.current) {
        window.clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };

    const scheduleStallTimer = () => {
      clearStallTimer();
      stallTimerRef.current = window.setTimeout(() => {
        const now = Date.now();
        if (stallFiredRef.current) return;
        if (document.visibilityState !== "visible") {
          scheduleStallTimer();
          return;
        }
        const idleMs = now - lastActivityAtRef.current;
        if (idleMs < stallAfterMs) {
          scheduleStallTimer();
          return;
        }
        stallFiredRef.current = true;
        void trackMobileEvent("stall_detected", {
          page,
          route: latestRouteRef.current,
          source: source || undefined,
          category: category || undefined,
          product_id: productId || undefined,
          user_product_id: userProductId || undefined,
          compare_id: compareId || undefined,
          dwell_ms: now - startedAtRef.current,
          idle_ms: idleMs,
          ...latestExtraRef.current,
        });
      }, stallAfterMs);
    };

    const touchActivity = () => {
      lastActivityAtRef.current = Date.now();
      if (!stallFiredRef.current) {
        scheduleStallTimer();
      }
    };

    const handleClick = (event: Event) => {
      touchActivity();
      const targetId = findAnalyticsTargetId(event.target);
      if (!targetId) return;
      const now = Date.now();
      const sameTarget = targetId === lastClickTargetRef.current;
      if (sameTarget && now - lastClickAtRef.current <= RAGE_CLICK_WINDOW_MS) {
        clickCountRef.current += 1;
      } else {
        clickCountRef.current = 1;
      }
      lastClickTargetRef.current = targetId;
      lastClickAtRef.current = now;

      if (clickCountRef.current < RAGE_CLICK_THRESHOLD || rageFiredTargetsRef.current.has(targetId)) {
        return;
      }
      rageFiredTargetsRef.current.add(targetId);
      void trackMobileEvent("rage_click", {
        page,
        route: latestRouteRef.current,
        source: source || undefined,
        category: category || undefined,
        product_id: productId || undefined,
        user_product_id: userProductId || undefined,
        compare_id: compareId || undefined,
        target_id: targetId,
        click_count: clickCountRef.current,
        ...latestExtraRef.current,
      });
    };

    scheduleStallTimer();
    window.addEventListener("scroll", touchActivity, { passive: true });
    window.addEventListener("pointerdown", touchActivity, { passive: true });
    window.addEventListener("keydown", touchActivity);
    document.addEventListener("click", handleClick, true);

    return () => {
      clearStallTimer();
      window.removeEventListener("scroll", touchActivity);
      window.removeEventListener("pointerdown", touchActivity);
      window.removeEventListener("keydown", touchActivity);
      document.removeEventListener("click", handleClick, true);
    };
  }, [category, compareId, page, productId, route, source, stallAfterMs, userProductId]);

  return null;
}
