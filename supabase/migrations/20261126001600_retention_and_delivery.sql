-- Gate 5: retenção de dados (LGPD, minimização) e fila de entrega de notificações por e-mail e Web Push.

-- ============ Retenção ============
-- Padrões por igreja podem ser sobrescritos em church_settings.retention_policy:
--   notifications_read_days (180), notifications_unread_days (365), ai_raw_output_days (90).
-- audit_logs é append-only e NÃO entra aqui.
create or replace function private.run_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_notif_read integer; v_notif_unread integer; v_ai integer; v_deliveries integer; v_buckets integer; v_idem integer; v_invites integer;
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

  return jsonb_build_object('notifications_read', v_notif_read, 'notifications_unread', v_notif_unread, 'ai_raw_output', v_ai,
    'deliveries', v_deliveries, 'rate_limit_buckets', v_buckets, 'idempotency_keys', v_idem, 'invitations', v_invites);
end $$;
revoke all on function private.run_retention() from public, anon, authenticated;

-- ============ Fila de entrega ============
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  church_id uuid not null references public.churches(id),
  user_id uuid not null references public.profiles(id),
  channel public.notification_channel not null check (channel in ('push','email')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_error text check (char_length(last_error) <= 200),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_due_idx on public.notification_deliveries (status, next_attempt_at);
alter table public.notification_deliveries enable row level security;
-- O titular pode ver o estado das próprias entregas; ninguém escreve (somente funções abaixo, via service role).
grant select on public.notification_deliveries to authenticated;
create policy deliveries_own_select on public.notification_deliveries for select to authenticated using (user_id = (select auth.uid()));

-- E-mail: só com opt-in explícito (preferência enabled). Push: só com inscrição ativa e sem opt-out.
create or replace function private.enqueue_notification_deliveries() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.notification_preferences np
              where np.church_id = new.church_id and np.user_id = new.user_id and np.category = new.category and np.channel = 'email' and np.enabled) then
    insert into public.notification_deliveries (notification_id, church_id, user_id, channel) values (new.id, new.church_id, new.user_id, 'email')
      on conflict (notification_id, channel) do nothing;
  end if;
  if exists (select 1 from public.push_subscriptions ps where ps.user_id = new.user_id)
     and not exists (select 1 from public.notification_preferences np
                      where np.church_id = new.church_id and np.user_id = new.user_id and np.category = new.category and np.channel = 'push' and not np.enabled) then
    insert into public.notification_deliveries (notification_id, church_id, user_id, channel) values (new.id, new.church_id, new.user_id, 'push')
      on conflict (notification_id, channel) do nothing;
  end if;
  return new;
end $$;
create trigger trg_notifications_enqueue after insert on public.notifications
  for each row execute function private.enqueue_notification_deliveries();

-- Trabalhador (service role): reserva um lote. SKIP LOCKED evita envio duplo entre execuções concorrentes.
create or replace function public.claim_notification_deliveries(p_limit integer)
returns table (delivery_id uuid, channel public.notification_channel, attempts smallint, title text, body text, link_path text, email text, subscriptions jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select d.id from public.notification_deliveries d
     where (d.status = 'pending' and d.next_attempt_at <= now()) or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
     order by d.next_attempt_at
     limit greatest(1, least(p_limit, 100))
     for update skip locked),
  upd as (
    update public.notification_deliveries d set status = 'sending', claimed_at = now(), attempts = d.attempts + 1
      from due where d.id = due.id returning d.*)
  select u.id, u.channel, u.attempts, n.title, n.body, n.link_path,
         case when u.channel = 'email' then (select au.email::text from auth.users au where au.id = u.user_id) end,
         case when u.channel = 'push' then coalesce((select jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth_secret))
                                                        from public.push_subscriptions ps where ps.user_id = u.user_id), '[]'::jsonb) end
    from upd u join public.notifications n on n.id = u.notification_id;
end $$;

create or replace function public.complete_notification_delivery(p_id uuid, p_status text, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempts smallint;
begin
  if p_status not in ('sent','failed','skipped') then raise exception 'status inválido' using errcode = '22023'; end if;
  select attempts into v_attempts from public.notification_deliveries where id = p_id for update;
  if not found then return; end if;
  if p_status = 'failed' and v_attempts < 5 then
    -- backoff exponencial: 1, 2, 4, 8 minutos
    update public.notification_deliveries set status = 'pending', claimed_at = null, last_error = left(p_error, 200),
           next_attempt_at = now() + make_interval(mins => (2 ^ (v_attempts - 1))::integer) where id = p_id;
  else
    update public.notification_deliveries set status = p_status, claimed_at = null, last_error = left(p_error, 200),
           sent_at = case when p_status = 'sent' then now() end where id = p_id;
  end if;
end $$;

-- Inscrições mortas (404/410 do serviço de push) são removidas pelo trabalhador.
create or replace function public.drop_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.claim_notification_deliveries(integer), public.complete_notification_delivery(uuid, text, text), public.drop_push_subscription(text) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer), public.complete_notification_delivery(uuid, text, text), public.drop_push_subscription(text) to service_role;

-- ============ Agendamentos (pg_cron), quando disponível ============
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('igrejaqua-retention', '17 3 * * *', 'select private.run_retention()');
  else
    raise notice 'pg_cron indisponível: a retenção precisa ser executada por outro agendador (select private.run_retention()).';
  end if;
end $$;
