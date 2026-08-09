const UAE_PASS_NO_EMAIL_SUFFIX = '@no-email.uaepass.invalid';

/**
 * Prefer the native Supabase Auth email, then the contact email projected from
 * UAE PASS into the customer profile. Never expose the internal placeholder
 * used for genuinely email-less custom-provider accounts.
 */
export function resolveCustomerEmail(
  authEmail: string | null | undefined,
  profileEmail: string | null | undefined,
): string | null {
  const email = authEmail?.trim() || profileEmail?.trim();
  if (!email || email.toLowerCase().endsWith(UAE_PASS_NO_EMAIL_SUFFIX)) return null;
  return email;
}

/**
 * Supabase owns verification for native email/password identities. UAE PASS
 * documents the email it returns as verified, but its generic OAuth2 response
 * does not include the OIDC `email_verified` boolean Supabase expects. A
 * provider-only UAE PASS account can therefore trust its projected profile
 * email without pretending that Supabase confirmed an email identity.
 *
 * Do not extend the UAE PASS fallback to an account that also has an email
 * identity: in that case the profile email belongs to Supabase's native flow
 * and must be confirmed there.
 */
export function isCustomerEmailVerified({
  email,
  authEmailVerified,
  uaePassAuthenticated,
  emailPasswordAuthenticated,
}: {
  email: string | null;
  authEmailVerified: boolean;
  uaePassAuthenticated: boolean;
  emailPasswordAuthenticated: boolean;
}): boolean {
  if (!email) return false;
  return authEmailVerified || (uaePassAuthenticated && !emailPasswordAuthenticated);
}
