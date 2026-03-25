import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_CONSOLE_COOKIE_MAX_AGE_SECONDS,
  ADMIN_CONSOLE_COOKIE_NAME,
  getAdminConsolePassword,
  getConfiguredAdminConsoleSessionToken,
  normalizeAdminReturnTo,
} from "@/lib/adminAuth";
import { buildExternalUrl } from "@/lib/requestOrigin";

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isSecureRequest(req: NextRequest): boolean {
  if (req.nextUrl.protocol === "https:") return true;
  const forwardedProto = (req.headers.get("x-forwarded-proto") || "").toLowerCase();
  return forwardedProto.includes("https");
}

function buildRelativePath(pathname: string, params?: URLSearchParams): string {
  const query = params?.toString() || "";
  return `${pathname}${query ? `?${query}` : ""}`;
}

function redirectToAuth(req: NextRequest, errorCode: string, returnTo: string): NextResponse {
  const params = new URLSearchParams();
  params.set("error", errorCode);
  if (returnTo) {
    params.set("returnTo", returnTo);
  }
  return NextResponse.redirect(buildExternalUrl(req, buildRelativePath("/auth", params)), 303);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const password = formValue(formData, "password");
  const returnTo = normalizeAdminReturnTo(formValue(formData, "returnTo"));

  if (!password) {
    return redirectToAuth(req, "missing-password", returnTo);
  }

  const configuredPassword = getAdminConsolePassword();
  if (!configuredPassword) {
    return redirectToAuth(req, "config-missing", returnTo);
  }

  if (password !== configuredPassword) {
    return redirectToAuth(req, "invalid-password", returnTo);
  }

  const token = await getConfiguredAdminConsoleSessionToken();
  if (!token) {
    return redirectToAuth(req, "config-missing", returnTo);
  }

  const res = NextResponse.redirect(buildExternalUrl(req, returnTo), 303);
  res.cookies.set({
    name: ADMIN_CONSOLE_COOKIE_NAME,
    value: token,
    maxAge: ADMIN_CONSOLE_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/",
  });
  return res;
}
