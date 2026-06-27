import next from '@markaz/config/eslint/next';
export default [
  ...next,
  { ignores: ['.next/**', 'next-env.d.ts'] },
];
