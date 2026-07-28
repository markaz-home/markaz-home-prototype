#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const rules = [
  {
    name: 'private-key material',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: 'Supabase secret key', pattern: /\bsb_secret_[A-Za-z0-9_-]{24,}\b/ },
  {
    name: 'JWT-like credential',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b/,
  },
];

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const findings = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file);
  } catch {
    continue;
  }
  if (content.includes(0)) continue;
  const text = content.toString('utf8');
  for (const rule of rules) {
    if (rule.pattern.test(text)) findings.push({ file, rule: rule.name });
  }
}

if (findings.length) {
  console.error('Potential committed secrets detected (values intentionally suppressed):');
  for (const finding of findings) console.error(`- ${finding.rule}: ${finding.file}`);
  process.exit(1);
}

console.log(`Secrets scan passed: ${files.length} repository files checked; 0 findings.`);
