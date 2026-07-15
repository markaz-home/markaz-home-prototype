import base from './base.js';
import globals from 'globals';
import nextPlugin from '@next/eslint-plugin-next';

/** Next.js app flat config — extends the shared base with browser + JSX globals and
 * the official @next/eslint-plugin-next rules (recommended + core-web-vitals), so
 * `next build` no longer warns that the Next.js ESLint plugin is not configured. */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    languageOptions: {
      globals: { ...globals.browser, React: 'readonly' },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Next pages/layouts legitimately default-export components.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
