import 'server-only';

/**
 * Google credentials live in Google/Supabase, never in the web application.
 * Supabase's public Auth settings are the source of truth for whether the
 * provider is available. GOOGLE_AUTH_ENABLED remains an optional emergency
 * visibility override for environments that need to force the entry point on
 * or off independently of provider discovery.
 */
export async function isGoogleAuthEnabled(): Promise<boolean> {
  const override = process.env.GOOGLE_AUTH_ENABLED?.trim();
  if (override === 'true') return true;
  if (override === 'false') return false;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      cache: 'no-store',
    });
    if (!response.ok) return false;

    const settings = (await response.json()) as {
      external?: Record<string, boolean | undefined>;
    };
    return settings.external?.google === true;
  } catch {
    // Auth screens remain usable with email/password if provider discovery is
    // temporarily unavailable.
    return false;
  }
}
