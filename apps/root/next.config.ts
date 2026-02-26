import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kaca/common'],
  serverExternalPackages: ['pdf-parse', 'cfb'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
