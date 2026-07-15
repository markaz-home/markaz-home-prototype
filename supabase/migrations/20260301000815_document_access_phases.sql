-- Week 6 closure: make private-document access audit wording exact. The single
-- pre-mint event 'ADMIN_PRIVATE_DOCUMENT_ACCESSED' could falsely claim access
-- succeeded when the signed-URL mint failed. Split into an explicit lifecycle:
--   REQUESTED (before mint) → GRANTED (mint ok) | FAILED (mint failed).
-- The URL and Storage path are NEVER recorded (only documentType + reason + result).
drop function if exists public.admin_record_document_access(text, uuid, text, text);

create or replace function public.admin_record_document_access(
  p_entity_type text, p_entity_id uuid, p_document_type text, p_reason text, p_phase text
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_action text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  v_action := case p_phase
    when 'REQUESTED' then 'ADMIN_DOCUMENT_ACCESS_REQUESTED'
    when 'GRANTED'   then 'ADMIN_DOCUMENT_ACCESS_GRANTED'
    else                  'ADMIN_DOCUMENT_ACCESS_FAILED'
  end;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_action, p_entity_type, p_entity_id,
          jsonb_build_object('documentType', p_document_type, 'reason', p_reason, 'result', p_phase));
end $$;

revoke all on function public.admin_record_document_access(text, uuid, text, text, text) from public, anon;
grant execute on function public.admin_record_document_access(text, uuid, text, text, text) to authenticated, service_role;
