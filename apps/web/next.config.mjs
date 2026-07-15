import { config as loadEnv } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

// Env precedence (Next convention): .env.local (gitignored, local-dev overrides) wins,
// then the shared monorepo-root .env (the hosted/deploy contract). dotenv keeps the FIRST
// value it sees for a key, so load .env.local first. Missing .env.local is a silent no-op
// (e.g. on Vercel, where env comes from the dashboard).
loadEnv({ path: '../../.env.local' });
loadEnv({ path: '../../.env' });

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint (incl. the @next/eslint-plugin-next rules) runs as its own `pnpm lint`
  // step and in CI; Next's build-time lint is redundant here and, with flat config,
  // emits a spurious "plugin not detected" warning. Lint is NOT skipped overall.
  eslint: { ignoreDuringBuilds: true },
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
