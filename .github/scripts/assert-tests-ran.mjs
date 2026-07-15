// Asserts a Vitest JSON report represents a suite that GENUINELY RAN.
// Enforces the reviewer's "skip/vacuous = fail" gate: the integration suites must
// actually execute against the live stack — a green command that skipped everything
// (the old demo-seed early-return antipattern) or ran zero tests is a FAILURE here.
//
// Usage: node assert-tests-ran.mjs <path-to-vitest-report.json> [minTests]
import { readFileSync } from 'node:fs';

const [, , reportPath, minTestsArg] = process.argv;
if (!reportPath) {
  console.error('usage: assert-tests-ran.mjs <vitest-report.json> [minTests]');
  process.exit(2);
}
const minTests = Number(minTestsArg ?? 1);

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (e) {
  console.error(`FAIL: could not read/parse ${reportPath}: ${e.message}`);
  process.exit(1);
}

const total = report.numTotalTests ?? 0;
const passed = report.numPassedTests ?? 0;
const failed = report.numFailedTests ?? 0;
const skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);

console.log(`total=${total} passed=${passed} failed=${failed} skipped=${skipped}`);

const problems = [];
if (total < minTests) problems.push(`ran ${total} tests (< required ${minTests}) — vacuous`);
if (failed > 0) problems.push(`${failed} failed`);
if (skipped > 0)
  problems.push(`${skipped} skipped/todo — integration suites must genuinely run (skip = fail)`);
if (passed !== total) problems.push(`passed(${passed}) !== total(${total})`);

if (problems.length) {
  console.error('FAIL: ' + problems.join('; '));
  process.exit(1);
}
console.log(`OK: ${passed} integration tests genuinely ran and passed (0 skipped).`);
