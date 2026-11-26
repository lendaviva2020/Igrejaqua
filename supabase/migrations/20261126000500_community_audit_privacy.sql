-- IGREJAQUA — 0005: comunicados, oração, notificações, PIX, auditoria, LGPD, infraestrutura

create table public.announcements_and_devotionals (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  kind public.content_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  body_md text not null check (char_length(body_md) <= 20000),
  audience public.content_audience not null default 'church',
  ministry_id uuid,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  scripture_ref text check (char_length(scripture_ref) <= 120),
  author_membership_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (church_id, id),
  foreign key (church_id) references public.churches (id),
  foreign key (church_id, ministry_id) references public.ministries (church_id, id),
  foreign key (church_id, author_membership_id) references public.church_memberships (church_id, id),
  check ((audience = 'ministry') = (ministry_id is not null)),
  check (status <> 'scheduled' or publish_at is not null)
);
create index content_church_status_idx on public.announcements_and_devotionals (church_id, status, published_at desc);
create trigger trg_content_updated before update on public.announcements_and_devotionals for each row execute function private.set_updated_at();

create or replace function private.content_publish_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
create trigger trg_content_publish before insert or update on public.announcements_and_devotionals
  for each row execute function private.content_publish_guard();

create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  status public.prayer_status not null default 'open',
  is_anonymous boolean not null default false,
  public_author_membership_id uuid,
  ministry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id) references public.churches (id),
  foreign key (church_id, ministry_id) references public.ministries (church_id, id),
  foreign key (church_id, public_author_membership_id) references public.church_memberships (church_id, id),
  check (not is_anonymous or public_author_membership_id is null)
);
create index prayer_church_idx on public.prayer_requests (church_id, status, created_at desc);
create trigger trg_prayer_updated before update on public.prayer_requests for each row execute function private.set_updated_at();

-- Autor SEMPRE aqui (mesmo em pedidos públicos); leitura apenas pelo próprio autor (SECURITY §8)
create table public.prayer_request_authors (
  prayer_request_id uuid primary key,
  church_id uuid not null,
  membership_id uuid not null,
  foreign key (church_id, prayer_request_id) references public.prayer_requests (church_id, id) on delete cascade,
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id)
);

create table public.prayer_interactions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  prayer_request_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default now(),
  unique (church_id, prayer_request_id, membership_id),
  foreign key (church_id, prayer_request_id) references public.prayer_requests (church_id, id) on delete cascade,
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  user_id uuid not null references public.profiles(id),
  category text not null check (char_length(category) <= 40),
  title text not null check (char_length(title) <= 160),
  body text check (char_length(body) <= 1000),
  link_path text check (link_path ~ '^/[A-Za-z0-9/_\-\.\?=&%]*$'),
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (church_id, user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, read_at);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  user_id uuid not null references public.profiles(id),
  category text not null check (char_length(category) <= 40),
  channel public.notification_channel not null,
  enabled boolean not null default true,
  unique (church_id, user_id, category, channel)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  pix_key_type public.pix_key_type not null,
  pix_key text not null check (char_length(pix_key) between 3 and 140),
  beneficiary_name text not null check (char_length(beneficiary_name) between 1 and 25),
  city text not null check (char_length(city) between 1 and 15),
  brcode_payload text check (char_length(brcode_payload) <= 1024),
  visible boolean not null default true,
  valid_until date,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id)
);
create trigger trg_contrib_updated before update on public.contributions for each row execute function private.set_updated_at();

create table public.audit_logs (
  id bigint generated always as identity primary key,
  church_id uuid references public.churches(id),
  actor_user_id uuid,
  actor_membership_id uuid,
  action text not null,
  entity_table text not null,
  entity_id text,
  diff jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index audit_logs_church_idx on public.audit_logs (church_id, created_at desc);

create or replace function private.audit_logs_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'audit_logs é append-only' using errcode = '42501'; end $$;
create trigger trg_audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();
create trigger trg_audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.audit_logs_immutable();

-- Auditoria genérica: registra APENAS nomes das colunas alteradas (nunca valores sensíveis)
create or replace function private.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_new jsonb; v_old jsonb; v_cols text[]; v_church uuid; v_id text; v_actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then v_old := to_jsonb(old); v_new := '{}'::jsonb;
  elsif tg_op = 'INSERT' then v_new := to_jsonb(new); v_old := '{}'::jsonb;
  else v_new := to_jsonb(new); v_old := to_jsonb(old); end if;
  select coalesce(array_agg(k order by k), '{}') into v_cols
    from (select k from jsonb_object_keys(v_new || v_old) k
          where (v_new -> k) is distinct from (v_old -> k) and k not in ('updated_at','created_at')) s;
  v_church := coalesce((v_new ->> 'church_id')::uuid, (v_old ->> 'church_id')::uuid,
                       case when tg_table_name = 'churches' then coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid) end);
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'church_id');
  insert into public.audit_logs (church_id, actor_user_id, actor_membership_id, action, entity_table, entity_id, diff)
  values (v_church, v_actor,
          case when v_actor is not null and v_church is not null then private.current_membership_id(v_church) end,
          lower(tg_op), tg_table_name, v_id, jsonb_build_object('columns', v_cols));
  return coalesce(new, old);
end $$;

create trigger trg_audit_church_memberships after insert or update or delete on public.church_memberships
  for each row execute function private.audit_row_change();
create trigger trg_audit_ministry_permissions after insert or update or delete on public.ministry_permissions
  for each row execute function private.audit_row_change();
create trigger trg_audit_event_lineup after insert or update or delete on public.event_lineup
  for each row execute function private.audit_row_change();
create trigger trg_audit_content after insert or update or delete on public.announcements_and_devotionals
  for each row execute function private.audit_row_change();
create trigger trg_audit_contributions after insert or update or delete on public.contributions
  for each row execute function private.audit_row_change();
create trigger trg_audit_church_settings after update on public.church_settings
  for each row execute function private.audit_row_change();
create trigger trg_audit_invitations after insert or update or delete on public.church_invitations
  for each row execute function private.audit_row_change();
create trigger trg_audit_churches after update on public.churches
  for each row execute function private.audit_row_change();

create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  user_id uuid not null references public.profiles(id),
  kind public.dsr_kind not null,
  status public.dsr_status not null default 'open',
  details text check (char_length(details) <= 2000),
  due_at timestamptz not null default (now() + interval '15 days'),
  resolved_at timestamptz,
  handled_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  church_id uuid references public.churches(id),
  purpose text not null check (purpose in ('terms','privacy','ai_data_sharing','image_use','religious_data')),
  version text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consent_user_idx on public.consent_records (user_id, purpose, created_at desc);

create table public.rate_limit_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  hits integer not null default 0
);

create table public.idempotency_keys (
  key text primary key,
  user_id uuid,
  response jsonb,
  created_at timestamptz not null default now()
);

-- Rate limit atômico (SECURITY §7): retorna true se dentro do limite
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  insert into public.rate_limit_buckets as b (bucket_key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
    set hits = case when b.window_start < now() - make_interval(secs => p_window_seconds) then 1 else b.hits + 1 end,
        window_start = case when b.window_start < now() - make_interval(secs => p_window_seconds) then now() else b.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;

-- ---------- Oração: criação atômica e moderação ----------
create or replace function public.create_prayer_request(p_church uuid, p_body text, p_anonymous boolean, p_ministry uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_m uuid := private.current_membership_id(p_church); v_id uuid;
begin
  if v_m is null then raise exception 'sem vínculo ativo' using errcode = '42501'; end if;
  insert into public.prayer_requests (church_id, body, is_anonymous, public_author_membership_id, ministry_id)
  values (p_church, btrim(p_body), p_anonymous, case when p_anonymous then null else v_m end, p_ministry)
  returning id into v_id;
  insert into public.prayer_request_authors (prayer_request_id, church_id, membership_id) values (v_id, p_church, v_m);
  return v_id;
end $$;

create or replace function public.moderate_prayer_request(p_request uuid, p_status public.prayer_status)
returns void language plpgsql security definer set search_path = '' as $$
declare v_church uuid; v_ministry uuid; v_author uuid;
begin
  select church_id, ministry_id into v_church, v_ministry from public.prayer_requests where id = p_request;
  if v_church is null then raise exception 'pedido inexistente' using errcode = 'P0002'; end if;
  select membership_id into v_author from public.prayer_request_authors where prayer_request_id = p_request;
  if not ( v_author = private.current_membership_id(v_church)
        or private.has_church_role(v_church, array['admin']::public.membership_role[])
        or (v_ministry is not null and private.has_ministry_permission(v_church, v_ministry, 'manage_content')) ) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.prayer_requests set status = p_status where id = p_request;
  insert into public.audit_logs (church_id, actor_user_id, actor_membership_id, action, entity_table, entity_id, diff)
  values (v_church, (select auth.uid()), private.current_membership_id(v_church), 'moderate', 'prayer_requests',
          p_request::text, jsonb_build_object('status', p_status));
end $$;
