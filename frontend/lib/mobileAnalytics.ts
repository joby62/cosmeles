"use client";

const MOBILE_EVENT_ENDPOINT = "/api/mobile/events";
const MOBILE_SESSION_STORAGE_KEY = "mx_mobile_analytics_session";
const MOBILE_TARGET_HANDLED_AT = new Map<string, number>();

type MobileAnalyticsProps = Record<string, unknown>;
type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function detectBrowserFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("micromessenger")) return "wechat";
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("firefox/")) return "firefox";
  if (ua.includes("crios/") || ua.includes("chrome/")) return "chrome";
  if (ua.includes("safari/")) return "safari";
  return "other";
}

function detectOsFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  if (ua.includes("android")) return "android";
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macos";
  if (ua.includes("windows")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "other";
}

function detectViewportBucket(width: number): string {
  if (width <= 0) return "unknown";
  if (width < 390) return "xs";
  if (width < 480) return "sm";
  if (width < 768) return "md";
  if (width < 1024) return "lg";
  return "xl";
}

function detectDeviceType(width: number): string {
  if (width <= 0) return "unknown";
  if (width < 768) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getMobileEnvironmentContext(): MobileAnalyticsProps {
  if (!canUseWindow()) return {};
  try {
    const nav = navigator as NavigatorWithConnection;
    const userAgent = String(nav.userAgent || "");
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    return {
      browser_family: detectBrowserFamily(userAgent),
      os_family: detectOsFamily(userAgent),
      lang: String(nav.language || "").trim() || undefined,
      network_type: String(nav.connection?.effectiveType || "").trim() || "unknown",
      save_data: Boolean(nav.connection?.saveData),
      viewport_bucket: detectViewportBucket(width),
      device_type: detectDeviceType(width),
    };
  } catch {
    return {};
  }
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

export function markMobileTargetHandled(targetId: string | null | undefined): void {
  const normalized = String(targetId || "").trim();
  if (!normalized) return;
  MOBILE_TARGET_HANDLED_AT.set(normalized, Date.now());
}

export function getMobileTargetHandledAt(targetId: string | null | undefined): number | null {
  const normalized = String(targetId || "").trim();
  if (!normalized) return null;
  return MOBILE_TARGET_HANDLED_AT.get(normalized) ?? null;
}

function buildPayload(name: string, props: MobileAnalyticsProps = {}): { name: string; props: MobileAnalyticsProps } {
  const sessionId = getMobileAnalyticsSessionId();
  return {
    name,
    props: {
      session_id: sessionId,
      client_ts: new Date().toISOString(),
      ...getMobileEnvironmentContext(),
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
