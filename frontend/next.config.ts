import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/temp-images/:path*',
        destination: 'http://localhost:3001/temp-images/:path*',
      },
    ];
  },
};

export default nextConfig;
