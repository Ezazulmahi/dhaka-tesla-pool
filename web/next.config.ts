import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see web/Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  // Keep the dev-only Next.js badge out of demos and screenshots.
  devIndicators: false,
};

export default nextConfig;
