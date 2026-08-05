import { z } from 'zod';
import { accountTypeSchema } from './account';
import { identityStatusSchema } from './identity';

export const phoneVerificationSourceSchema = z.enum(['MARKAZ_OTP', 'UAE_PASS']);
export type PhoneVerificationSource = z.infer<typeof phoneVerificationSourceSchema>;

const E164_PHONE = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize a customer-entered mobile number for contact storage only.
 *
 * Dubai-first conveniences accept `05…` and `971…`; all other numbers must
 * include an international `+` prefix. The result is never used as an account
 * identifier or native MARKAZ sign-in credential.
 */
export function normalizePhoneE164(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let compact = trimmed.replace(/[\s().-]/g, '');
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
  else if (compact.startsWith('05')) compact = `+971${compact.slice(1)}`;
  else if (compact.startsWith('971')) compact = `+${compact}`;

  return E164_PHONE.test(compact) ? compact : null;
}

/** Shape of a profiles row as seen by the application. */
export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  phoneE164: z.string().regex(E164_PHONE).nullable(),
  phoneVerifiedAt: z.string().datetime().nullable(),
  phoneVerificationSource: phoneVerificationSourceSchema.nullable(),
  accountType: accountTypeSchema,
  identityVerificationStatus: identityStatusSchema,
  termsAcceptedAt: z.string().datetime().nullable(),
  privacyAcceptedAt: z.string().datetime().nullable(),
  onboardingCompletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Profile = z.infer<typeof profileSchema>;

/**
 * First-time profile setup input.
 * Collects ONLY: full name, Terms acceptance, Privacy acceptance.
 * Optional contact mobile is added later from Profile. This onboarding fallback
 * never collects password, Emirates ID, passport, or buyer/seller role.
 */
export const profileSetupSchema = z.object({
  fullName: z.string().trim().min(2, 'full_name_too_short').max(120, 'full_name_too_long'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'terms_required' }),
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'privacy_required' }),
  }),
});
export type ProfileSetupInput = z.infer<typeof profileSetupSchema>;

/** Editable customer details. Mobile remains optional contact information. */
export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, 'full_name_too_short').max(120, 'full_name_too_long'),
  phone: z
    .string()
    .trim()
    .max(32, 'phone_invalid')
    .refine((value) => value === '' || normalizePhoneE164(value) !== null, 'phone_invalid'),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** A profile is "complete" once a name is set and both policies are accepted. */
export function isProfileComplete(
  profile: Pick<Profile, 'fullName' | 'termsAcceptedAt' | 'privacyAcceptedAt'>,
): boolean {
  return (
    !!profile.fullName &&
    profile.fullName.trim().length >= 2 &&
    !!profile.termsAcceptedAt &&
    !!profile.privacyAcceptedAt
  );
}
