"use client";

const MOBILE_EVENT_ENDPOINT = "/api/mobile/compare/events";
const MOBILE_SESSION_STORAGE_KEY = "mx_mobile_analytics_session";

type MobileAnalyticsProps = Record<string, unknown>;

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getMobileAnalyticsSessionId(): string | null {
  if (!canUseWindow()) return null;
  try {
    const existing = window.sessionStorage.getItem(MOBILE_SESSION_STORAGE_KEY)?.trim();
    if (existing) return existing;
    const created = newSessionId();
    window.sessionStorage.setItem(MOBILE_SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
}

function buildPayload(name: string, props: MobileAnalyticsProps = {}): { name: string; props: MobileAnalyticsProps } {
  const sessionId = getMobileAnalyticsSessionId();
  return {
    name,
    props: {
      session_id: sessionId,
      client_ts: new Date().toISOString(),
      ...props,
    },
  };
}

export async function trackMobileEvent(name: string, props: MobileAnalyticsProps = {}): Promise<void> {
  if (!name.trim()) return;
  const payload = buildPayload(name, props);
  try {
    await fetch(MOBILE_EVENT_ENDPOINT, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // 埋点失败不阻塞主流程
  }
}

export function trackMobileEventWithBeacon(name: string, props: MobileAnalyticsProps = {}): void {
  if (!canUseWindow() || !name.trim()) return;
  const payload = buildPayload(name, props);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(MOBILE_EVENT_ENDPOINT, blob);
      return;
    }
  } catch {
    // Fall through to fetch keepalive.
  }
  void trackMobileEvent(name, props);
}
