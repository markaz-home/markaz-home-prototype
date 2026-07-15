import type { AuthErrorKey } from '@markaz/domain';

/** zod field-error codes → `validation` translation keys (design spec §20). */
export const FIELD_ERROR_KEYS: Record<string, string> = {
  full_name_too_short: 'fullNameTooShort',
  full_name_too_long: 'fullNameTooLong',
  email_required: 'emailEmpty',
  email_invalid: 'emailInvalid',
  password_required: 'passwordEmpty',
  password_too_short: 'passwordTooShort',
  password_too_long: 'passwordTooLong',
  password_policy: 'passwordPolicy',
  password_mismatch: 'passwordMismatch',
  terms_required: 'termsRequired',
  privacy_required: 'privacyRequired',
};

/** Provider error keys (mapAuthError) → `validation` translation keys. */
export const AUTH_ERROR_KEYS: Record<AuthErrorKey, string> = {
  invalid_credentials: 'incorrectCredentials',
  email_not_confirmed: 'emailUnverified',
  rate_limited: 'rateLimited',
  weak_password: 'passwordTooShort',
  invalid_code: 'codeInvalid',
  expired_code: 'codeExpired',
  session_missing: 'invalidRecoverySession',
  provider_unavailable: 'providerUnavailable',
  generic: 'unexpectedError',
};
