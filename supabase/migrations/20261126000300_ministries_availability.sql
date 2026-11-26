-- IGREJAQUA — 0003: ministérios, permissões granulares, disponibilidade

create table public.ministries (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,58})[a-z0-9]$'),
  kind text not null default 'general' check (char_length(kind) <= 40),
  description text check (char_length(description) <= 1000),
  color_token text check (char_length(color_token) <= 32),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  unique (church_id, slug)
);
create trigger trg_ministries_updated before update on public.ministries
  for each row execute function private.set_updated_at();

create table public.ministry_memberships (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  ministry_id uuid not null,
  membership_id uuid not null,
  role public.ministry_member_role not null default 'member',
  instruments text[] not null default '{}',
  voice_part text check (char_length(voice_part) <= 40),
  vocal_range_low smallint check (vocal_range_low between 0 and 127),
  vocal_range_high smallint check (vocal_range_high between 0 and 127),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  unique (church_id, ministry_id, id),
  unique (church_id, ministry_id, membership_id),
  foreign key (church_id, ministry_id) references public.ministries (church_id, id),
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id),
  check (vocal_range_low is null or vocal_range_high is null or vocal_range_low <= vocal_range_high)
);
create index ministry_memberships_person_idx on public.ministry_memberships (church_id, membership_id);
create trigger trg_ministry_memberships_updated before update on public.ministry_memberships
  for each row execute function private.set_updated_at();

create table public.ministry_permissions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  ministry_id uuid not null,
  ministry_membership_id uuid not null,
  permission public.ministry_permission not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  unique (church_id, ministry_membership_id, permission),
  foreign key (church_id, ministry_id, ministry_membership_id)
    references public.ministry_memberships (church_id, ministry_id, id) on delete cascade
);
create index ministry_permissions_lookup_idx on public.ministry_permissions (church_id, ministry_id, permission);

create table public.unavailabilities (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  membership_id uuid not null,
  during daterange not null check (not isempty(during)),
  weekdays smallint[] check (weekdays is null or (weekdays <@ array[0,1,2,3,4,5,6]::smallint[] and cardinality(weekdays) > 0)),
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id)
);
create index unavailabilities_range_idx on public.unavailabilities using gist (church_id, membership_id, during);

-- ---------- Funções de permissão ----------
create or replace function private.has_ministry_permission(p_church uuid, p_ministry uuid, p_perm public.ministry_permission)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_church_role(p_church, array['admin']::public.membership_role[])
      or exists (
        select 1
        from public.ministry_memberships mm
        join public.ministry_permissions mp on mp.ministry_membership_id = mm.id and mp.church_id = mm.church_id
        where mm.church_id = p_church and mm.ministry_id = p_ministry and mm.active
          and mm.membership_id = private.current_membership_id(p_church)
          and mp.permission = p_perm);
$$;

create or replace function private.has_any_ministry_permission(p_church uuid, p_perms public.ministry_permission[])
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_church_role(p_church, array['admin']::public.membership_role[])
      or exists (
        select 1
        from public.ministry_memberships mm
        join public.ministry_permissions mp on mp.ministry_membership_id = mm.id and mp.church_id = mm.church_id
        where mm.church_id = p_church and mm.active
          and mm.membership_id = private.current_membership_id(p_church)
          and mp.permission = any (p_perms));
$$;

create or replace function private.is_ministry_member(p_church uuid, p_ministry uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ministry_memberships mm
    where mm.church_id = p_church and mm.ministry_id = p_ministry and mm.active
      and mm.membership_id = private.current_membership_id(p_church));
$$;

grant execute on function private.has_ministry_permission(uuid, uuid, public.ministry_permission),
  private.has_any_ministry_permission(uuid, public.ministry_permission[]),
  private.is_ministry_member(uuid, uuid) to authenticated;

-- Anti-escalada: só concede permissão que possui; não altera as próprias (exceto admin)
create or replace function private.ministry_permissions_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_target_membership uuid; v_is_admin boolean;
begin
  if v_actor is null then
    if tg_op = 'INSERT' then new.granted_by := null; end if;
    return coalesce(new, old);
  end if;
  v_is_admin := private.has_church_role(coalesce(new.church_id, old.church_id), array['admin']::public.membership_role[]);
  if tg_op = 'DELETE' then
    select mm.membership_id into v_target_membership from public.ministry_memberships mm where mm.id = old.ministry_membership_id;
    if not v_is_admin and v_target_membership = private.current_membership_id(old.church_id) then
      raise exception 'não é permitido revogar as próprias permissões' using errcode = '42501';
    end if;
    return old;
  end if;
  select mm.membership_id into v_target_membership from public.ministry_memberships mm where mm.id = new.ministry_membership_id;
  if not v_is_admin then
    if v_target_membership = private.current_membership_id(new.church_id) then
      raise exception 'não é permitido conceder permissões a si mesmo' using errcode = '42501';
    end if;
    if not private.has_ministry_permission(new.church_id, new.ministry_id, 'manage_ministry') then
      raise exception 'requer manage_ministry' using errcode = '42501';
    end if;
    if not private.has_ministry_permission(new.church_id, new.ministry_id, new.permission) then
      raise exception 'não é possível conceder permissão que você não possui' using errcode = '42501';
    end if;
  end if;
  new.granted_by := v_actor;
  return new;
end $$;
create trigger trg_ministry_permissions_guard before insert or delete on public.ministry_permissions
  for each row execute function private.ministry_permissions_guard();

-- Membro de ministério precisa ter vínculo ativo (R-04)
create or replace function private.ministry_memberships_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.active and not exists (select 1 from public.church_memberships m
      where m.id = new.membership_id and m.church_id = new.church_id and m.status = 'active') then
    raise exception 'vínculo com a igreja precisa estar ativo' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_ministry_memberships_guard before insert or update on public.ministry_memberships
  for each row execute function private.ministry_memberships_guard();

-- Disponibilidade de uma pessoa para uma data (R-10). Sem expor motivo.
create or replace function private.is_unavailable_on(p_church uuid, p_membership uuid, p_day date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.unavailabilities u
    where u.church_id = p_church and u.membership_id = p_membership
      and u.during @> p_day
      and (u.weekdays is null or extract(dow from p_day)::smallint = any (u.weekdays)));
$$;
grant execute on function private.is_unavailable_on(uuid, uuid, date) to authenticated;
