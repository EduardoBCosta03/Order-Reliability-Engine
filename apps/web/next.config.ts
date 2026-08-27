import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Linting is owned by the repository-level CI step before build.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
