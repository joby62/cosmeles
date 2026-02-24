import type { NextConfig } from "next";

const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = "8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/api/:path*`,
      },
      {
        source: "/images/:path*",
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/images/:path*`,
      },
    ];
  },
};

export default nextConfig;