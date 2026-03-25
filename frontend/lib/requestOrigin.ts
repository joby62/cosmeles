import { NextRequest } from "next/server";

function firstHeaderValue(value: string | null): string {
  return String(value || "")
    .split(",")[0]
    .trim();
}

function normalizeProtocol(value: string): string {
  const normalized = String(value || "").trim().toLowerCase().replace(/:$/, "");
  if (normalized === "http" || normalized === "https") return normalized;
  return "";
}

function normalizeHost(value: string): string {
  return String(value || "").trim();
}

function isInternalHost(host: string): boolean {
  const normalized = normalizeHost(host).toLowerCase();
  if (!normalized) return true;
  if (normalized === "0.0.0.0" || normalized === "localhost") return true;
  if (normalized === "127.0.0.1" || normalized === "::1") return true;
  if (!normalized.includes(".")) return true;
  return false;
}

export function getRequestExternalOrigin(req: NextRequest): string {
  const forwardedProto = normalizeProtocol(firstHeaderValue(req.headers.get("x-forwarded-proto")));
  const forwardedHost = normalizeHost(firstHeaderValue(req.headers.get("x-forwarded-host")));
  const hostHeader = normalizeHost(firstHeaderValue(req.headers.get("host")));

  if (forwardedProto && forwardedHost && !isInternalHost(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (forwardedProto && hostHeader && !isInternalHost(hostHeader)) {
    return `${forwardedProto}://${hostHeader}`;
  }

  const nextUrlHost = normalizeHost(req.nextUrl.host);
  const nextUrlProtocol = normalizeProtocol(req.nextUrl.protocol);
  if (nextUrlProtocol && nextUrlHost && !isInternalHost(nextUrlHost)) {
    return `${nextUrlProtocol}://${nextUrlHost}`;
  }

  if (req.nextUrl.origin && !isInternalHost(req.nextUrl.host)) {
    return req.nextUrl.origin;
  }

  const fallbackHost = forwardedHost || hostHeader || nextUrlHost;
  const fallbackProtocol = forwardedProto || nextUrlProtocol || "https";
  return `${fallbackProtocol}://${fallbackHost}`;
}

export function buildExternalUrl(req: NextRequest, path: string): string {
  return new URL(path, getRequestExternalOrigin(req)).toString();
}
