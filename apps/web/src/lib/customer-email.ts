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
