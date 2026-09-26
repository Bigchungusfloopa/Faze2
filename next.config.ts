import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - devIndicators can be set to false at runtime to hide the static indicator
  devIndicators: false,
  // Native binary used to render scanned PDF pages; must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@napi-rs/canvas"],
  async redirects() {
    return [{ source: "/research", destination: "/chat", permanent: false }];
  },
};

export default nextConfig;
