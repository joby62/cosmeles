import type { NextConfig } from "next";

const BACKEND_HOST = process.env.BACKEND_HOST || "127.0.0.1";
const BACKEND_PORT = process.env.BACKEND_PORT || "8000";
const INTERNAL_API_BASE =
  process.env.INTERNAL_API_BASE ||
  process.env.API_INTERNAL_ORIGIN ||
  `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const ASSET_PUBLIC_ORIGIN = (process.env.ASSET_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_ASSET_BASE || "")
  .trim()
  .replace(/\/$/, "");
const NEXT_COMPRESS = (process.env.NEXT_COMPRESS || "").trim().toLowerCase();
const FALLBACK_IMAGE_REMOTE_ORIGINS = [
  "https://assets.yuexuan.xyz",
  "https://yuexuan.xyz",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://api:8000",
] as const;

function parseRemotePattern(origin: string):
  | {
      protocol: "http" | "https";
      hostname: string;
      port?: string;
    }
  | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const protocol = url.protocol.replace(":", "");
    if (protocol !== "http" && protocol !== "https") return null;
    return {
      protocol,
      hostname: url.hostname,
      port: url.port || undefined,
    };
  } catch {
    return null;
  }
}

function collectRemotePatterns(origins: readonly string[]) {
  const seen = new Set<string>();
  const patterns: Array<{
    protocol: "http" | "https";
    hostname: string;
    port?: string;
  }> = [];

  for (const origin of origins) {
    const pattern = parseRemotePattern(origin);
    if (!pattern) continue;
    const key = `${pattern.protocol}:${pattern.hostname}:${pattern.port || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    patterns.push(pattern);
  }

  return patterns;
}

// `next/image` remotePatterns is frozen at build time. Keep production asset hosts
// in a fallback list so a missed build arg does not 400 every remote product image.
const imageRemotePatterns = collectRemotePatterns([
  ASSET_PUBLIC_ORIGIN,
  process.env.NEXT_PUBLIC_ASSET_BASE || "",
  process.env.API_PUBLIC_ORIGIN || "",
  ...FALLBACK_IMAGE_REMOTE_ORIGINS,
]);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Phase-14 keeps the existing default, but exposes a profile-aware switch for later runtime split.
  compress: NEXT_COMPRESS ? NEXT_COMPRESS === "true" : false,
  experimental: {
    // Allow frontend modules to import repo-level shared contracts and decision catalogs.
    externalDir: true,
  },
  images: imageRemotePatterns.length > 0
    ? {
        remotePatterns: imageRemotePatterns,
      }
    : undefined,

  async rewrites() {
    const rewrites = [
      {
        source: "/api/:path*",
        destination: `${INTERNAL_API_BASE}/api/:path*`,
      },
    ];
    if (!ASSET_PUBLIC_ORIGIN) {
      rewrites.push(
        {
          source: "/images/:path*",
          destination: `${INTERNAL_API_BASE}/images/:path*`,
        },
        {
          source: "/user-images/:path*",
          destination: `${INTERNAL_API_BASE}/user-images/:path*`,
        },
      );
    }
    return rewrites;
  },
};

export default nextConfig;
