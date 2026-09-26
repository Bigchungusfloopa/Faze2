import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - devIndicators can be set to false at runtime to hide the static indicator
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/vault",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
