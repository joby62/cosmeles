"use client";

const MOBILE_EVENT_ENDPOINT = "/api/mobile/events";
const MOBILE_SESSION_STORAGE_KEY = "mx_mobile_analytics_session";
const MOBILE_LOCATION_PROMPT_STATE_KEY = "mx_mobile_location_prompt_state";
const MOBILE_LOCATION_CONTEXT_KEY = "mx_mobile_location_context";
const MOBILE_TARGET_HANDLED_AT = new Map<string, number>();

type MobileAnalyticsProps = Record<string, unknown>;
type MobileLocationPromptState = "granted" | "dismissed" | "denied";
type MobileLocationContext = {
  location_permission: "granted";
  location_source: "browser_geolocation";
  location_precision: "coarse";
  location_latitude: number;
  location_longitude: number;
  location_accuracy_m?: number;
  location_time_zone?: string;
  location_label: string;
  location_captured_at: string;
};
type MobileLocationRequestResult =
  | { status: "granted"; context: MobileLocationContext }
  | { status: "denied"; reason: string }
  | { status: "error"; reason: string }
  | { status: "unsupported"; reason: string };

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
  deviceMemory?: number;
  userAgentData?: {
    platform?: string;
    mobile?: boolean;
  };
};

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function canUseStorage(): boolean {
  return canUseWindow() && typeof window.localStorage !== "undefined";
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

function detectDeviceMemoryBucket(value: unknown): string {
  const memory = Number(value);
  if (!Number.isFinite(memory) || memory <= 0) return "unknown";
  if (memory <= 1) return "lte1";
  if (memory <= 2) return "2gb";
  if (memory <= 4) return "4gb";
  if (memory <= 8) return "8gb";
  return "gt8gb";
}

function detectCpuCoreBucket(value: unknown): string {
  const cores = Number(value);
  if (!Number.isFinite(cores) || cores <= 0) return "unknown";
  if (cores <= 2) return "lte2";
  if (cores <= 4) return "4";
  if (cores <= 6) return "6";
  if (cores <= 8) return "8";
  return "gt8";
}

function detectTouchPointsBucket(value: unknown): string {
  const touchPoints = Number(value);
  if (!Number.isFinite(touchPoints) || touchPoints < 0) return "unknown";
  if (touchPoints === 0) return "0";
  if (touchPoints === 1) return "1";
  if (touchPoints <= 4) return "2_4";
  return "5_plus";
}

function supportsMobileLocationCapture(): boolean {
  return canUseWindow() && Boolean(window.isSecureContext) && typeof navigator !== "undefined" && "geolocation" in navigator;
}

function readMobileLocationPromptState(): MobileLocationPromptState | null {
  if (!canUseStorage()) return null;
  try {
    const value = String(window.localStorage.getItem(MOBILE_LOCATION_PROMPT_STATE_KEY) || "").trim();
    if (value === "granted" || value === "dismissed" || value === "denied") return value;
    return null;
  } catch {
    return null;
  }
}

function writeMobileLocationPromptState(value: MobileLocationPromptState): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(MOBILE_LOCATION_PROMPT_STATE_KEY, value);
  } catch {
    // Ignore storage failures and keep the UX non-blocking.
  }
}

function readMobileLocationContext(): MobileLocationContext | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(MOBILE_LOCATION_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MobileLocationContext | null;
    if (!parsed || parsed.location_permission !== "granted") return null;
    if (!Number.isFinite(Number(parsed.location_latitude)) || !Number.isFinite(Number(parsed.location_longitude))) return null;
    if (!String(parsed.location_label || "").trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMobileLocationContext(context: MobileLocationContext): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(MOBILE_LOCATION_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage failures and keep the UX non-blocking.
  }
}

function clearMobileLocationContext(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(MOBILE_LOCATION_CONTEXT_KEY);
  } catch {
    // Ignore storage failures and keep the UX non-blocking.
  }
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatLocationLabel(context: {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  timeZone?: string;
}): string {
  const parts = [`${context.latitude.toFixed(3)}, ${context.longitude.toFixed(3)}`];
  if (typeof context.accuracyM === "number" && Number.isFinite(context.accuracyM) && context.accuracyM > 0) {
    parts.push(`+-${Math.round(context.accuracyM)}m`);
  }
  if (context.timeZone) parts.push(context.timeZone);
  return parts.join(" · ");
}

function geolocationErrorReason(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return "permission_denied";
  if (error.code === error.POSITION_UNAVAILABLE) return "position_unavailable";
  if (error.code === error.TIMEOUT) return "timeout";
  return "geolocation_error";
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
      device_memory_bucket: detectDeviceMemoryBucket(nav.deviceMemory),
      cpu_core_bucket: detectCpuCoreBucket(nav.hardwareConcurrency),
      touch_points_bucket: detectTouchPointsBucket(nav.maxTouchPoints),
      online_state: typeof nav.onLine === "boolean" ? (nav.onLine ? "online" : "offline") : "unknown",
      ...readMobileLocationContext(),
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

export function getStoredMobileLocationPromptState(): MobileLocationPromptState | null {
  return readMobileLocationPromptState();
}

export function dismissMobileLocationPrompt(): void {
  writeMobileLocationPromptState("dismissed");
}

export function getStoredMobileLocationContext(): MobileAnalyticsProps | null {
  return readMobileLocationContext();
}

export async function requestMobileLocationContext(): Promise<MobileLocationRequestResult> {
  if (!supportsMobileLocationCapture()) {
    const secure = canUseWindow() && Boolean(window.isSecureContext);
    return { status: "unsupported", reason: secure ? "geolocation_unavailable" : "insecure_context" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = roundCoordinate(position.coords.latitude);
        const longitude = roundCoordinate(position.coords.longitude);
        const accuracyM = Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : undefined;
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
        const context: MobileLocationContext = {
          location_permission: "granted",
          location_source: "browser_geolocation",
          location_precision: "coarse",
          location_latitude: latitude,
          location_longitude: longitude,
          location_accuracy_m: accuracyM,
          location_time_zone: timeZone,
          location_label: formatLocationLabel({ latitude, longitude, accuracyM, timeZone }),
          location_captured_at: new Date().toISOString(),
        };
        writeMobileLocationContext(context);
        writeMobileLocationPromptState("granted");
        resolve({ status: "granted", context });
      },
      (error) => {
        const reason = geolocationErrorReason(error);
        if (reason === "permission_denied") {
          writeMobileLocationPromptState("denied");
          clearMobileLocationContext();
          resolve({ status: "denied", reason });
          return;
        }
        resolve({ status: "error", reason });
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 1000 * 60 * 30,
      },
    );
  });
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
