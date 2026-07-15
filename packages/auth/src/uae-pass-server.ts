import 'server-only';

/**
 * Next.js server-only boundary for UAE PASS configuration.
 *
 * The underlying config is also consumed by the standalone Node setup script,
 * where importing the `server-only` poison pill would intentionally throw. Next
 * application code must use this guarded subpath instead.
 */
export {
  UAE_PASS_PROVIDER,
  UAE_PASS_STAGING_ENDPOINTS,
  UAE_PASS_STAGING_SCOPE,
  UAE_PASS_STAGING_ACR,
  getUaePassMode,
  isUaePassStagingEnabled,
  getUaePassProviderConfig,
  type UaePassMode,
  type UaePassProviderConfig,
} from './uae-pass';
