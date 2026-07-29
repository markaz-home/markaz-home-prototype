import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

async function source(path) {
  return readFile(`${root}${path}`, 'utf8');
}

test('Platform Gold is the server-rendered default in both applications', async () => {
  const [webLayout, adminLayout, tokens, webLogo] = await Promise.all([
    source('apps/web/src/app/[locale]/layout.tsx'),
    source('apps/admin/src/app/[locale]/layout.tsx'),
    source('packages/ui/src/styles/globals.css'),
    source('apps/web/src/components/brand-logo.tsx'),
  ]);

  assert.match(webLayout, /<body className="theme-platform-gold /);
  assert.match(adminLayout, /<body className="theme-platform-gold /);
  assert.match(tokens, /:root \{[\s\S]*--background: 0 0% 5%;/);
  assert.match(tokens, /:root \{[\s\S]*--primary: 31 41% 63%;/);
  assert.doesNotMatch(tokens, /209 64% 16%|206 58% 29%|216 38% 97%/);
  assert.match(webLogo, /src="\/markaz-logo-gold\.png"/);
  assert.doesNotMatch(webLogo, /variant|logo-web/);
});
