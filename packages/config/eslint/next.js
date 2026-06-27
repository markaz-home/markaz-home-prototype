import base from './base.js';
import globals from 'globals';

/** Next.js app flat config — extends the shared base with browser + JSX globals. */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, React: 'readonly' },
    },
    rules: {
      // Next pages/layouts legitimately default-export components.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
