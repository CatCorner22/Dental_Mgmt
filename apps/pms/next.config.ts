import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@pms/clinical-core",
    "@pms/clinical-kb",
    "@pms/controls-engine",
    "@pms/db",
    "@pms/verifier",
  ],
};

export default nextConfig;
