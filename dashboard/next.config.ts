import type { NextConfig } from "next";
import path from "node:path";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

const nextConfig: NextConfig = {
  // Pin turbopack root to this dashboard dir so it doesn't pick the parent
  // hunch/ folder (which also has a package-lock.json) as the workspace root.
  turbopack: {
    root: path.resolve("."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
