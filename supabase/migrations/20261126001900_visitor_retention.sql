-- Retenção de contato de visitantes (padrão 365 dias; sobrescrevível em church_settings.retention_policy.visitor_contact_days).
-- Reescreve private.run_retention() incluindo a nova etapa; permissões idênticas às da migration 1600.
create or replace function private.run_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_notif_read integer; v_notif_unread integer; v_ai integer; v_deliveries integer; v_buckets integer; v_idem integer; v_invites integer; v_visitors integer;
begin
  with doomed as (
    delete from public.notifications n
     using public.church_settings s
     where s.church_id = n.church_id
       and ((n.read_at is not null and n.read_at < now() - make_interval(days => coalesce((s.retention_policy ->> 'notifications_read_days')::integer, 180)))
         or (n.read_at is null and n.created_at < now() - make_interval(days => coalesce((s.retention_policy ->> 'notifications_unread_days')::integer, 365))))
    returning n.read_at)
  select count(*) filter (where read_at is not null), count(*) filter (where read_at is null) into v_notif_read, v_notif_unread from doomed;

  with cleaned as (
    update public.ai_generation_runs r set raw_output = null
     from public.church_settings s
     where s.church_id = r.church_id and r.raw_output is not null
       and r.created_at < now() - make_interval(days => coalesce((s.retention_policy ->> 'ai_raw_output_days')::integer, 90))
    returning 1)
  select count(*) into v_ai from cleaned;

  with d as (delete from public.notification_deliveries where status in ('sent','failed','skipped') and created_at < now() - interval '90 days' returning 1)
  select count(*) into v_deliveries from d;
  with b as (delete from public.rate_limit_buckets where window_start < now() - interval '2 days' returning 1)
  select count(*) into v_buckets from b;
  with i as (delete from public.idempotency_keys where created_at < now() - interval '7 days' returning 1)
  select count(*) into v_idem from i;
  with v as (delete from public.church_invitations where coalesce(accepted_at, expires_at) < now() - interval '30 days' returning 1)
  select count(*) into v_invites from v;

  -- Minimização (LGPD art. 6º, III): contato de visitante sem atividade há muito tempo é apagado; nome e histórico ficam.
  with vis as (
    update public.visitors v set phone = null, email = null, contact_consent_at = null
     from public.church_settings s
     where s.church_id = v.church_id and (v.phone is not null or v.email is not null)
       and greatest(v.updated_at, coalesce((select max(f.created_at) from public.visit_followups f where f.church_id = v.church_id and f.visitor_id = v.id), v.created_at))
           < now() - make_interval(days => coalesce((s.retention_policy ->> 'visitor_contact_days')::integer, 365))
    returning 1)
  select count(*) into v_visitors from vis;

  return jsonb_build_object('notifications_read', v_notif_read, 'notifications_unread', v_notif_unread, 'ai_raw_output', v_ai,
    'deliveries', v_deliveries, 'rate_limit_buckets', v_buckets, 'idempotency_keys', v_idem, 'invitations', v_invites, 'visitor_contacts', v_visitors);
end $$;
revoke all on function private.run_retention() from public, anon, authenticated;
