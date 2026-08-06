#!/usr/bin/env node
import { EnvironmentValidationError, validateEnvironment } from './environment.mjs';

const app = process.argv[2] ?? 'all';

try {
  const result = validateEnvironment(process.env, { app });
  console.log(
    `Configuration valid for ${result.app} (${result.deploymentEnvironment}); ` +
      `UAE PASS=${result.uaePassMode}, Google=${result.googleAuthMode}, ` +
      `BayutAPI=${result.bayutApiMode}.`,
  );
  for (const warning of result.warnings) console.warn(`Configuration notice: ${warning}`);
} catch (error) {
  if (error instanceof EnvironmentValidationError) {
    console.error(error.message);
  } else {
    console.error('Environment validation failed with an unexpected configuration error.');
  }
  process.exit(1);
}
