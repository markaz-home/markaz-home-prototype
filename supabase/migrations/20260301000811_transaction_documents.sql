-- Week 5 — transaction document register/remove (SECURITY DEFINER) + checklist gating.
-- The file itself is uploaded by the participant to the private `transaction-documents`
-- bucket (storage RLS: owner = auth.uid()); this records the row, scoped + validated.

-- Register an uploaded fictional document. The object key MUST be
-- `${transactionId}/${uploaderId}/…` so a customer cannot register a cross-transaction file.
create or replace function public.tx_register_document(
  p_transaction uuid, p_type text, p_path text, p_filename text, p_mime text, p_size int)
returns public.transaction_documents
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.transactions; v_side text; v_doc public.transaction_documents;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_t from public.transactions where id = p_transaction for update;
  if not found or v_uid not in (v_t.buyer_user_id, v_t.seller_user_id) then raise exception 'NOT_FOUND'; end if;
  if v_t.status in ('COMPLETED_DEMO','CANCELLED','FAILED') then raise exception 'TERMINAL'; end if;
  v_side := case when v_uid = v_t.buyer_user_id then 'BUYER' else 'SELLER' end;
  if (v_side = 'BUYER' and p_type not like 'BUYER_%') or (v_side = 'SELLER' and p_type not like 'SELLER_%') then
    raise exception 'NOT_YOUR_TASK';
  end if;
  if p_mime not in ('application/pdf','image/jpeg','image/png') then raise exception 'INVALID_MIME'; end if;
  if p_size <= 0 or p_size > 10485760 then raise exception 'INVALID_SIZE'; end if;
  if p_path not like (p_transaction::text || '/' || v_uid::text || '/%') then raise exception 'INVALID_PATH'; end if;

  -- One active file per (transaction, uploader, type): supersede the previous.
  update public.transaction_documents set status = 'REMOVED', updated_at = now()
    where transaction_id = p_transaction and uploaded_by = v_uid and document_type = p_type and status <> 'REMOVED';
  insert into public.transaction_documents
    (transaction_id, uploaded_by, document_type, storage_path, file_name, mime_type, size_bytes, status)
  values (p_transaction, v_uid, p_type, p_path, p_filename, p_mime, p_size, 'ACCEPTED_DEMO')
  returning * into v_doc;

  insert into public.transaction_events (transaction_id, event_type, actor, metadata)
    values (p_transaction, 'DOCUMENT_UPLOADED', v_side::public.transaction_actor, jsonb_build_object('type', p_type));
  -- Audit records only the type — never filename, path, or content.
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'TRANSACTION_DOCUMENT_UPLOADED', 'transaction', p_transaction, jsonb_build_object('type', p_type));
  return v_doc;
end $$;

create or replace function public.tx_remove_document(p_transaction uuid, p_document uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_doc public.transaction_documents;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_doc from public.transaction_documents where id = p_document and transaction_id = p_transaction for update;
  if not found or v_doc.uploaded_by <> v_uid then raise exception 'NOT_FOUND'; end if;
  update public.transaction_documents set status = 'REMOVED', updated_at = now() where id = p_document;
  insert into public.transaction_events (transaction_id, event_type, metadata)
    values (p_transaction, 'DOCUMENT_REMOVED', jsonb_build_object('type', v_doc.document_type));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'TRANSACTION_DOCUMENT_REMOVED', 'transaction', p_transaction, jsonb_build_object('type', v_doc.document_type));
end $$;

-- Gate the document-checklist completion on the participant's required identity file being
-- present (fictional). Re-creates tx_complete_task with that check for the DOCUMENTS codes.
create or replace function public.tx_complete_task(p_transaction uuid, p_code text, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_t public.transactions; v_side public.transaction_actor; v_task public.transaction_tasks;
  v_allowed text[] := array['BUYER_CONFIRM_DETAILS','SELLER_CONFIRM_DETAILS','BUYER_DOCUMENTS','SELLER_DOCUMENTS',
                            'BUYER_REVIEW_SUMMARY','SELLER_REVIEW_SUMMARY','BUYER_CONFIRM_READINESS','SELLER_CONFIRM_READINESS'];
  v_recipient uuid; v_evt public.transaction_event_type; v_reqtype text;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if v_t.status = 'CANCELLATION_PENDING' then raise exception 'CANCELLATION_PENDING'; end if;
  if not (p_code = any(v_allowed)) then raise exception 'INVALID_TASK'; end if;

  select * into v_task from public.transaction_tasks where transaction_id = p_transaction and code = p_code for update;
  if not found then raise exception 'INVALID_TASK'; end if;
  if v_task.assigned_actor <> v_side then raise exception 'NOT_YOUR_TASK'; end if;
  if v_task.stage <> public.tx_active_stage(p_transaction) then raise exception 'NOT_ACTIONABLE'; end if;
  if v_task.status = 'COMPLETED_DEMO' then return v_t; end if;

  -- Document checklist requires the participant's fictional identity file.
  if p_code in ('BUYER_DOCUMENTS','SELLER_DOCUMENTS') then
    v_reqtype := case when p_code = 'BUYER_DOCUMENTS' then 'BUYER_IDENTITY' else 'SELLER_IDENTITY' end;
    if not exists (select 1 from public.transaction_documents
                   where transaction_id = p_transaction and uploaded_by = auth.uid()
                     and document_type = v_reqtype and status <> 'REMOVED') then
      raise exception 'DOCUMENT_REQUIRED';
    end if;
  end if;

  update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
    where id = v_task.id;

  v_evt := case
    when p_code like '%CONFIRM_DETAILS' then 'DETAILS_CONFIRMED'
    when p_code like '%REVIEW_SUMMARY'  then 'SUMMARY_REVIEWED'
    when p_code like '%READINESS'       then 'TRANSFER_READINESS_CONFIRMED'
    else 'SUMMARY_REVIEWED' end;
  insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, v_evt, v_side);

  v_recipient := case when v_side = 'BUYER' then v_t.seller_user_id else v_t.buyer_user_id end;
  insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_recipient, 'IN_APP', 'TRANSACTION_ACTION_REQUIRED', jsonb_build_object('transactionId', p_transaction));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'TRANSACTION_TASK_COMPLETED', 'transaction', p_transaction, jsonb_build_object('code', p_code));

  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction;
  return v_t;
end $$;

grant execute on function
  public.tx_register_document(uuid, text, text, text, text, int),
  public.tx_remove_document(uuid, uuid)
  to authenticated, service_role;
