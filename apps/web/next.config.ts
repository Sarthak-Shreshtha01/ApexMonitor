import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (apps/web/Dockerfile).
  output: "standalone",
  // npm workspaces hoist dependencies to the repo root, so trace files from there.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
