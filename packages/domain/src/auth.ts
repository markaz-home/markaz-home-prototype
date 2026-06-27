import { z } from 'zod';

/**
 * Email/password authentication helpers (Week 1.5, ADR-0009).
 * No passwords, codes, or tokens are ever stored or logged by app code.
 */

/** Canonical email normalisation: trim + lowercase (matches Supabase matching). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'email_required')
  .email('email_invalid')
  .transform(normalizeEmail);

/** Full name: required, trimmed, sensible bounds, Unicode-friendly (Arabic OK). */
export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'full_name_too_short')
  .max(120, 'full_name_too_long');

// --- Password policy ---------------------------------------------------------
// Min 8, upper, lower, number, special. Max 72 = the provider's bcrypt-safe limit
// (not an arbitrary low cap). Pasting is supported (plain string field).
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export interface PasswordRequirements {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= PASSWORD_MIN,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordMeetsPolicy(password: string): boolean {
  const r = checkPasswordRequirements(password);
  return r.minLength && r.uppercase && r.lowercase && r.number && r.special;
}

/** 0–4 coarse strength score for the meter (UX only, not a security control). */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const r = checkPasswordRequirements(password);
  let score = [r.uppercase, r.lowercase, r.number, r.special].filter(Boolean).length;
  if (password.length >= 12) score = Math.min(4, score + 1);
  if (!r.minLength) score = Math.min(score, 1);
  return Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
}

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, 'password_too_short')
  .max(PASSWORD_MAX, 'password_too_long')
  .refine((v) => passwordMeetsPolicy(v), 'password_policy');

// --- Schemas -----------------------------------------------------------------
export const signUpSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'terms_required' }) }),
    acceptPrivacy: z.literal(true, { errorMap: () => ({ message: 'privacy_required' }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password_mismatch',
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password_required'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password_mismatch',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Build the Supabase user_metadata passed to signUp (full name + consent). */
export function buildSignupMetadata(input: Pick<SignUpInput, 'fullName' | 'acceptTerms' | 'acceptPrivacy'>) {
  return {
    full_name: input.fullName.trim(),
    terms_accepted: input.acceptTerms === true,
    privacy_accepted: input.acceptPrivacy === true,
  };
}

// --- Safe error mapping ------------------------------------------------------
// Map provider errors to stable, non-enumerating UI keys. Never surface raw DB
// errors or reveal whether an email exists / which field was wrong.
export type AuthErrorKey =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'weak_password'
  | 'invalid_code'
  | 'expired_code'
  | 'session_missing'
  | 'provider_unavailable'
  | 'generic';

export function mapAuthError(err: { message?: string; status?: number; code?: string } | null): AuthErrorKey {
  if (!err) return 'generic';
  if (err.status === 429 || err.code === 'over_request_rate_limit' || err.code === 'over_email_send_rate_limit')
    return 'rate_limited';
  const m = (err.message ?? '').toLowerCase();
  if (m.includes('email not confirmed') || err.code === 'email_not_confirmed') return 'email_not_confirmed';
  if (m.includes('invalid login credentials') || err.code === 'invalid_credentials') return 'invalid_credentials';
  if (m.includes('weak password') || err.code === 'weak_password') return 'weak_password';
  if (m.includes('expired')) return 'expired_code';
  if (m.includes('token') || m.includes('otp') || m.includes('invalid')) return 'invalid_code';
  if (m.includes('session') || m.includes('auth session missing')) return 'session_missing';
  if ((err.status ?? 0) >= 500) return 'provider_unavailable';
  return 'generic';
}

/**
 * Supabase anti-enumeration: signUp for an existing CONFIRMED email returns a
 * user with an empty identities array and no error. Detect that to show safe
 * "account may exist" copy without ever querying the profiles table.
 */
export function isLikelyExistingAccount(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}
