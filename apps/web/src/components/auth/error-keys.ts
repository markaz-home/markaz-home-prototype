import type { AuthErrorKey } from '@markaz/domain';

/** zod field-error codes → `auth` translation keys. */
export const FIELD_ERROR_KEYS: Record<string, string> = {
  full_name_too_short: 'fullNameTooShort',
  full_name_too_long: 'fullNameTooLong',
  email_required: 'emailRequired',
  email_invalid: 'emailInvalid',
  password_too_short: 'passwordTooShort',
  password_too_long: 'passwordTooLong',
  password_policy: 'passwordPolicy',
  password_mismatch: 'passwordMismatch',
  password_required: 'passwordRequired',
  terms_required: 'termsRequired',
  privacy_required: 'privacyRequired',
};

/** Provider error keys (mapAuthError) → `auth` translation keys. */
export const AUTH_ERROR_KEYS: Record<AuthErrorKey, string> = {
  invalid_credentials: 'errInvalidCredentials',
  email_not_confirmed: 'errEmailNotConfirmed',
  rate_limited: 'errRateLimited',
  weak_password: 'passwordPolicy',
  invalid_code: 'errInvalidCode',
  expired_code: 'errExpiredCode',
  session_missing: 'errSessionMissing',
  provider_unavailable: 'errProviderUnavailable',
  generic: 'errGeneric',
};
