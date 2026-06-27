import { config as loadEnv } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

// Load the shared monorepo-root .env so both apps use one environment contract.
loadEnv({ path: '../../.env' });

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@markaz/ui',
    '@markaz/i18n',
    '@markaz/auth',
    '@markaz/api',
    '@markaz/db',
    '@markaz/domain',
    '@markaz/realtime',
    '@markaz/observability',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default withNextIntl(nextConfig);
