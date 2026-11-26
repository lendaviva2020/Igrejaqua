-- IGREJAQUA — 0002: identidade global, igrejas, vínculos, convites

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 160),
  display_name text check (char_length(display_name) <= 80),
  avatar_path text,
  phone text check (char_length(phone) <= 32),
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$'),
  name text not null check (char_length(name) between 2 and 160),
  legal_name text check (char_length(legal_name) <= 200),
  document_number text check (char_length(document_number) <= 20),
  timezone text not null default 'America/Sao_Paulo',
  status public.church_status not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_churches_updated before update on public.churches
  for each row execute function private.set_updated_at();

create table public.church_memberships (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  user_id uuid not null references public.profiles(id),
  role public.membership_role not null default 'member',
  status public.membership_status not null default 'active',
  is_owner boolean not null default false,
  joined_at timestamptz not null default now(),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  unique (church_id, user_id),
  check (not is_owner or role = 'admin')
);
create index church_memberships_user_idx on public.church_memberships (user_id, status);
create trigger trg_memberships_updated before update on public.church_memberships
  for each row execute function private.set_updated_at();

create table public.church_settings (
  church_id uuid primary key references public.churches(id),
  locale text not null default 'pt-BR',
  week_starts_on smallint not null default 0 check (week_starts_on between 0 and 6),
  rotation_policy jsonb not null default
    '{"window_weeks":8,"max_gap":2,"max_per_month":4,"allow_back_to_back":false,"allow_multi_function":false}'::jsonb,
  ai_enabled boolean not null default false,
  ai_data_sharing_consent_at timestamptz,
  stage_defaults jsonb not null default '{}'::jsonb,
  retention_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_settings_updated before update on public.church_settings
  for each row execute function private.set_updated_at();

create table public.church_invitations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  email extensions.citext not null,
  role public.membership_role not null default 'member',
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (church_id, id)
);
create index church_invitations_church_idx on public.church_invitations (church_id, accepted_at);

-- ---------- Funções de apoio (usadas por políticas RLS) ----------
create or replace function private.is_active_member(p_church uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.church_memberships m
    join public.churches c on c.id = m.church_id
    where m.church_id = p_church
      and m.user_id = (select auth.uid())
      and m.status = 'active' and c.status = 'active');
$$;

create or replace function private.has_church_role(p_church uuid, p_roles public.membership_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.church_memberships m
    join public.churches c on c.id = m.church_id
    where m.church_id = p_church
      and m.user_id = (select auth.uid())
      and m.status = 'active' and c.status = 'active'
      and m.role = any (p_roles));
$$;

create or replace function private.current_membership_id(p_church uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.church_memberships m
  where m.church_id = p_church and m.user_id = (select auth.uid()) and m.status = 'active'
  limit 1;
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.is_active_member(uuid), private.has_church_role(uuid, public.membership_role[]),
  private.current_membership_id(uuid) to authenticated;

-- Perfil criado no cadastro
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Usuário'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Proteções dos vínculos: imutabilidade, anti-escalada, último admin/owner
create or replace function private.memberships_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if new.church_id <> old.church_id or new.user_id <> old.user_id then
    raise exception 'church_id e user_id são imutáveis' using errcode = '42501';
  end if;

  if (new.role, new.is_owner, new.status) is distinct from (old.role, old.is_owner, old.status) then
    if v_actor is not null then
      if not private.has_church_role(old.church_id, array['admin']::public.membership_role[]) then
        raise exception 'apenas admin altera papel/status' using errcode = '42501';
      end if;
      if old.user_id = v_actor and (new.role, new.is_owner) is distinct from (old.role, old.is_owner) then
        raise exception 'não é permitido alterar o próprio papel' using errcode = '42501';
      end if;
      if new.is_owner is distinct from old.is_owner
         and not exists (select 1 from public.church_memberships o
                         where o.church_id = old.church_id and o.user_id = v_actor and o.is_owner and o.status = 'active') then
        raise exception 'apenas owner altera propriedade' using errcode = '42501';
      end if;
    end if;

    if old.status = 'active' and old.role = 'admin' and (new.status <> 'active' or new.role <> 'admin') then
      if not exists (select 1 from public.church_memberships o
                     where o.church_id = old.church_id and o.id <> old.id and o.role = 'admin' and o.status = 'active') then
        raise exception 'a igreja precisa de ao menos um admin ativo' using errcode = '23514';
      end if;
    end if;
    if old.is_owner and old.status = 'active' and (not new.is_owner or new.status <> 'active') then
      if not exists (select 1 from public.church_memberships o
                     where o.church_id = old.church_id and o.id <> old.id and o.is_owner and o.status = 'active') then
        raise exception 'a igreja precisa de ao menos um owner ativo' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_memberships_guard before update on public.church_memberships
  for each row execute function private.memberships_guard();

-- Criação de igreja (único caminho para inserir igreja + owner)
create or replace function public.create_church(p_name text, p_slug text, p_timezone text default 'America/Sao_Paulo')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_church uuid;
begin
  if v_user is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  insert into public.churches (name, slug, timezone, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), p_timezone, v_user) returning id into v_church;
  insert into public.church_settings (church_id) values (v_church);
  insert into public.church_memberships (church_id, user_id, role, status, is_owner)
  values (v_church, v_user, 'admin', 'active', true);
  return v_church;
end $$;

-- Aceite de convite: valida token (hash), e-mail e validade
create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower((select auth.jwt() ->> 'email'));
  v_inv public.church_invitations%rowtype;
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  if v_user is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select * into v_inv from public.church_invitations
   where token_hash = v_hash and accepted_at is null and expires_at > now() for update;
  if not found then raise exception 'convite inválido ou expirado' using errcode = 'P0002'; end if;
  if lower(v_inv.email::text) <> v_email then
    raise exception 'convite emitido para outro e-mail' using errcode = '42501';
  end if;
  insert into public.church_memberships (church_id, user_id, role, status, invited_by)
  values (v_inv.church_id, v_user, v_inv.role, 'active', v_inv.invited_by)
  on conflict (church_id, user_id) do update
    set status = 'active', role = excluded.role
    where public.church_memberships.status in ('invited','left');
  update public.church_invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_inv.church_id;
end $$;

-- Diretório mínimo (sem telefone) para membros ativos da mesma igreja
create or replace function public.church_directory(p_church uuid)
returns table (membership_id uuid, user_id uuid, display_name text, avatar_path text, role public.membership_role, status public.membership_status)
language sql stable security definer set search_path = '' as $$
  select m.id, m.user_id, coalesce(p.display_name, p.full_name), p.avatar_path, m.role, m.status
  from public.church_memberships m join public.profiles p on p.id = m.user_id
  where m.church_id = p_church and private.is_active_member(p_church)
    and (m.status = 'active' or private.has_church_role(p_church, array['admin']::public.membership_role[]))
    and p.deleted_at is null;
$$;
