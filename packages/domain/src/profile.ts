import { z } from 'zod';
import { accountTypeSchema } from './account';
import { identityStatusSchema } from './identity';

/** Shape of a profiles row as seen by the application. */
export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  accountType: accountTypeSchema,
  identityVerificationStatus: identityStatusSchema,
  termsAcceptedAt: z.string().datetime().nullable(),
  privacyAcceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Profile = z.infer<typeof profileSchema>;

/**
 * First-time profile setup input.
 * Collects ONLY: full name, Terms acceptance, Privacy acceptance.
 * Never collects password, phone, Emirates ID, passport, or buyer/seller role.
 */
export const profileSetupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'full_name_too_short')
    .max(120, 'full_name_too_long'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'terms_required' }),
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'privacy_required' }),
  }),
});
export type ProfileSetupInput = z.infer<typeof profileSetupSchema>;

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
