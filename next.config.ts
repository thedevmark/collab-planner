import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    lockDistDir: false,
    isolatedDevBuild: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
      },
    ],
  },
};

export default nextConfig;
