import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    lockDistDir: false,
    isolatedDevBuild: false,
  },
};

export default nextConfig;
