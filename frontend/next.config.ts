import type { NextConfig } from "next";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8001";
let apiHost = "127.0.0.1";
let apiProtocol: "http" | "https" = "http";
let apiPort = "8001";

try {
  const u = new URL(apiBase);
  apiHost = u.hostname;
  apiProtocol = (u.protocol.replace(":", "") as any) || "http";
  apiPort = u.port || (apiProtocol === "https" ? "443" : "80");
} catch {}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: apiProtocol,
        hostname: apiHost,
        port: apiPort,
        pathname: "/images/**",
      },
    ],
  },

  // 你看到的 “Cross origin request detected...” 警告：这里显式允许 dev origin
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;