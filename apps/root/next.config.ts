import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@edenschool/common'],
  serverExternalPackages: ['pdf-parse', 'cfb'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
