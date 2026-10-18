import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.76", "*.local"],
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  async headers() {
    return [
      {
        source: "/pdf.worker.min.mjs",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
