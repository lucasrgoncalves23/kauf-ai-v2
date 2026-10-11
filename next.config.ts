import type { NextConfig } from "next";

const portalHeaders = [
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/portal", headers: portalHeaders },
      { source: "/portal/:path*", headers: portalHeaders },
      { source: "/api/portal/:path*", headers: portalHeaders },
    ];
  },
};

export default nextConfig;
