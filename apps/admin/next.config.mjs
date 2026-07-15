import { config as loadEnv } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

// Env precedence: .env.local (gitignored, local-dev overrides) wins over the shared
// monorepo-root .env (hosted/deploy contract). dotenv keeps the first value per key, so
// load .env.local first. Missing .env.local is a silent no-op (e.g. on Vercel).
loadEnv({ path: '../../.env.local' });
loadEnv({ path: '../../.env' });
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint runs as its own `pnpm lint` step and in CI (with @next/eslint-plugin-next);
  // Next's build-time lint is redundant and warns spuriously under flat config.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    '@markaz/ui', '@markaz/i18n', '@markaz/auth', '@markaz/api',
    '@markaz/domain', '@markaz/observability',
  ],
  experimental: { optimizePackageImports: ['lucide-react'] },
};
export default withNextIntl(nextConfig);
