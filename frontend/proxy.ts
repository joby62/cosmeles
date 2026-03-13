import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_CONSOLE_COOKIE_NAME,
  isAdminProtectedPath,
  isValidAdminConsoleSession,
} from "@/lib/adminAuth";

const MOBILE_DEVICE_COOKIE = "mx_device_id";
const MOBILE_DEVICE_HEADER = "x-mobile-device-id";
const MOBILE_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

function isMobileUA(ua: string) {
  return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function resolveDeviceId(req: NextRequest): { value: string; fromCookie: boolean } {
  const cookieValue = req.cookies.get(MOBILE_DEVICE_COOKIE)?.value?.trim() || "";
  if (cookieValue) return { value: cookieValue, fromCookie: true };
  const forwarded = req.headers.get(MOBILE_DEVICE_HEADER)?.trim() || "";
  if (forwarded) return { value: forwarded, fromCookie: false };
  return { value: crypto.randomUUID(), fromCookie: false };
}

function isSecureRequest(req: NextRequest): boolean {
  if (req.nextUrl.protocol === "https:") return true;
  const forwardedProto = (req.headers.get("x-forwarded-proto") || "").toLowerCase();
  return forwardedProto.includes("https");
}

function withDeviceIdentity(req: NextRequest, res: NextResponse): NextResponse {
  const { value: deviceId, fromCookie } = resolveDeviceId(req);
  if (!fromCookie) {
    res.cookies.set({
      name: MOBILE_DEVICE_COOKIE,
      value: deviceId,
      maxAge: MOBILE_DEVICE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(req),
      path: "/",
    });
  }
  return res;
}

function passThrough(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  headers.set(MOBILE_DEVICE_HEADER, resolveDeviceId(req).value);
  return withDeviceIdentity(req, NextResponse.next({ request: { headers } }));
}

function redirectToAdminAuth(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.pathname = "/auth";
  url.search = "";
  url.searchParams.set("returnTo", returnTo);
  return withDeviceIdentity(req, NextResponse.redirect(url, 302));
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasFileExt = /\.[a-zA-Z0-9]+$/.test(pathname);

  if (
    hasFileExt ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/user-images") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap")
  ) {
    return passThrough(req);
  }

  if (isAdminProtectedPath(pathname)) {
    const session = req.cookies.get(ADMIN_CONSOLE_COOKIE_NAME)?.value;
    const isAuthed = await isValidAdminConsoleSession(session);
    if (!isAuthed) return redirectToAdminAuth(req);
    return passThrough(req);
  }

  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    return passThrough(req);
  }

  if (pathname.startsWith("/m")) {
    return passThrough(req);
  }

  const ua = req.headers.get("user-agent") || "";
  if (!isMobileUA(ua)) {
    return passThrough(req);
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/m" : `/m${pathname}`;
  url.search = search;
  return withDeviceIdentity(req, NextResponse.redirect(url, 302));
}

export const config = {
  matcher: ["/((?!_next|api|images|user-images|favicon.ico).*)"],
};
