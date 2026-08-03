-- =============================================================================
-- UAE PASS Staging — login only until explicitly linked
--
-- Public UAE PASS staging does not provide an email_verified claim. Automatic
-- first-time OAuth provisioning can consequently create an email-less Supabase
-- user whose provider identity later prevents the intended email/password user
-- from linking it. This Before User Created hook rejects only that CreateAccount
-- path. A signed-in customer using auth.linkIdentity() has a target user already,
-- so GoTrue does not run this hook and the explicit link remains available.
-- =============================================================================

create or replace function public.hook_prevent_unlinked_uae_pass_signup(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if event->'user'->'app_metadata'->>'provider' = 'custom:uae-pass' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        -- A stable, non-enumerating marker consumed by the application callback.
        -- Do not include provider attributes or an email address here.
        'message', 'MARKAZ_UAE_PASS_NOT_LINKED'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute
  on function public.hook_prevent_unlinked_uae_pass_signup(jsonb)
  to supabase_auth_admin;

revoke execute
  on function public.hook_prevent_unlinked_uae_pass_signup(jsonb)
  from authenticated, anon, public;
