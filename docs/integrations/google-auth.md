# Google authentication

Google is an optional Supabase Auth provider for creating or returning to a MARKAZ CUSTOMER. The
application requests only the standard OpenID, email, and profile scopes. Google access/refresh
tokens are not stored by MARKAZ.

## Environment setup

1. Create a Google OAuth **Web application** client.
2. Configure the customer application's origin in Google.
3. Configure the Supabase Auth callback shown by the target Supabase project as an authorized
   redirect URI. Local Supabase normally uses `http://127.0.0.1:54321/auth/v1/callback`.
4. Enable Google in the target Supabase project's Auth Providers settings with the client ID and
   secret.
5. Add the app callback (`https://<customer-origin>/auth/callback`) to Supabase's redirect allowlist.

For local Supabase, activate the documented `[auth.external.google]` block in
`supabase/config.toml`, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`, and restart the stack.
The default remains disabled so local development and CI never require Google credentials.

The sign-in and sign-up pages discover Google availability from Supabase Auth and show the button
as soon as the provider is enabled. `GOOGLE_AUTH_ENABLED=true|false` is an optional server-only
visibility override; it is not required for normal setup and never contains Google credentials.

## Account behavior

- A new Google subject creates one Supabase user and one CUSTOMER profile, prefilled with the
  provider name/email, then continues to MARKAZ Profile Setup for Terms/Privacy.
- A returning subject resolves the same user/profile.
- Supabase Auth may automatically link a verified matching email. MARKAZ performs no custom
  email/phone merge.
- An existing customer can explicitly link a provider identity when the product exposes that action.
- Google does not supply a mobile number for this flow.

Official setup reference: <https://supabase.com/docs/guides/auth/social-login/auth-google>.
