import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["pg", "bcryptjs"],
  transpilePackages: [
    "@pms/clinical-core",
    "@pms/clinical-kb",
    "@pms/controls-engine",
    "@pms/db",
    "@pms/verifier",
  ],
};

export default nextConfig;
