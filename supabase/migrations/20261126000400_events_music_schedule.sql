-- IGREJAQUA — 0004: repertório, eventos, sessões, escala, setlist, RSVP, presença

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  title text not null check (char_length(title) between 1 and 200),
  artist text check (char_length(artist) <= 200),
  default_key text check (default_key ~ '^[A-G][#b]?m?$'),
  tags text[] not null default '{}',
  language text not null default 'pt-BR',
  copyright_notice text check (char_length(copyright_notice) <= 500),
  ccli_number text check (char_length(ccli_number) <= 32),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (church_id, id)
);
create index songs_title_trgm_idx on public.songs using gin (title extensions.gin_trgm_ops);
create index songs_church_idx on public.songs (church_id) where deleted_at is null;
create trigger trg_songs_updated before update on public.songs for each row execute function private.set_updated_at();

create table public.song_versions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  song_id uuid not null,
  label text not null default 'Padrão' check (char_length(label) between 1 and 80),
  original_key text not null check (original_key ~ '^[A-G][#b]?m?$'),
  chordpro text not null default '' check (octet_length(chordpro) <= 65536),
  bpm smallint check (bpm between 30 and 300),
  time_signature text not null default '4/4' check (time_signature ~ '^[1-9][0-9]?/(2|4|8|16)$'),
  capo smallint check (capo between 0 and 11),
  duration_s integer check (duration_s between 10 and 7200),
  melody_low smallint check (melody_low between 0 and 127),
  melody_high smallint check (melody_high between 0 and 127),
  status public.content_status not null default 'draft',
  is_default boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (church_id, id),
  unique (church_id, song_id, label),
  foreign key (church_id, song_id) references public.songs (church_id, id),
  check (melody_low is null or melody_high is null or melody_low <= melody_high)
);
create unique index song_versions_one_default_idx on public.song_versions (church_id, song_id)
  where is_default and deleted_at is null;
create trigger trg_song_versions_updated before update on public.song_versions for each row execute function private.set_updated_at();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  title text not null check (char_length(title) between 2 and 200),
  kind public.event_kind not null default 'service',
  status public.event_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text check (char_length(location) <= 200),
  description text check (char_length(description) <= 4000),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (church_id, id),
  check (ends_at > starts_at)
);
create index events_church_start_idx on public.events (church_id, starts_at) where deleted_at is null;
create trigger trg_events_updated before update on public.events for each row execute function private.set_updated_at();

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  event_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text check (char_length(location) <= 200),
  ministry_id uuid,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id, event_id) references public.events (church_id, id) on delete cascade,
  foreign key (church_id, ministry_id) references public.ministries (church_id, id),
  check (ends_at > starts_at)
);
create index event_sessions_event_idx on public.event_sessions (church_id, event_id);
create index event_sessions_time_idx on public.event_sessions (church_id, starts_at, ends_at);
create trigger trg_event_sessions_updated before update on public.event_sessions for each row execute function private.set_updated_at();

create table public.ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  kind public.ai_run_kind not null,
  status public.ai_run_status not null default 'pending',
  requested_by uuid not null references public.profiles(id),
  target_session_id uuid,
  input_digest text,
  prompt_version text not null,
  model text,
  request_token_count integer,
  response_token_count integer,
  raw_output jsonb,
  validation_report jsonb,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id, target_session_id) references public.event_sessions (church_id, id)
);
create index ai_runs_church_idx on public.ai_generation_runs (church_id, created_at desc);
create trigger trg_ai_runs_updated before update on public.ai_generation_runs for each row execute function private.set_updated_at();

create table public.event_lineup (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  session_id uuid not null,
  ministry_id uuid not null,
  ministry_membership_id uuid not null,
  function text not null check (char_length(function) between 1 and 60),
  status public.lineup_status not null default 'draft',
  source text not null default 'manual' check (source in ('manual','ai')),
  ai_run_id uuid,
  override_reason text check (char_length(override_reason) <= 500),
  note text check (char_length(note) <= 280),
  responded_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  unique (church_id, session_id, ministry_membership_id, function),
  foreign key (church_id, session_id) references public.event_sessions (church_id, id) on delete cascade,
  foreign key (church_id, ministry_id, ministry_membership_id)
    references public.ministry_memberships (church_id, ministry_id, id),
  foreign key (church_id, ai_run_id) references public.ai_generation_runs (church_id, id)
);
create index event_lineup_person_idx on public.event_lineup (church_id, ministry_membership_id, status);
create index event_lineup_session_idx on public.event_lineup (church_id, session_id);
create trigger trg_event_lineup_updated before update on public.event_lineup for each row execute function private.set_updated_at();

create table public.event_setlist (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  session_id uuid not null,
  song_version_id uuid not null,
  position smallint not null check (position >= 0),
  target_key text check (target_key ~ '^[A-G][#b]?m?$'),
  capo_override smallint check (capo_override between 0 and 11),
  transition_note text check (char_length(transition_note) <= 500),
  lead_membership_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  unique (church_id, session_id, song_version_id),
  constraint event_setlist_position_uq unique (church_id, session_id, position) deferrable initially deferred,
  foreign key (church_id, session_id) references public.event_sessions (church_id, id) on delete cascade,
  foreign key (church_id, song_version_id) references public.song_versions (church_id, id),
  foreign key (church_id, lead_membership_id) references public.church_memberships (church_id, id)
);
create trigger trg_event_setlist_updated before update on public.event_setlist for each row execute function private.set_updated_at();

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  session_id uuid not null,
  membership_id uuid not null,
  status public.rsvp_status not null,
  guests smallint not null default 0 check (guests between 0 and 20),
  responded_at timestamptz not null default now(),
  unique (church_id, session_id, membership_id),
  foreign key (church_id, session_id) references public.event_sessions (church_id, id) on delete cascade,
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  session_id uuid not null,
  membership_id uuid not null,
  checked_in_at timestamptz not null default now(),
  method public.checkin_method not null default 'self',
  unique (church_id, session_id, membership_id),
  foreign key (church_id, session_id) references public.event_sessions (church_id, id) on delete cascade,
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id)
);

-- ---------- Regras de escala (R-07..R-11) ----------
create or replace function private.event_lineup_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_person uuid; v_tz text; v_session public.event_sessions%rowtype; v_policy jsonb;
  v_multi boolean; v_conflict boolean;
begin
  if tg_op = 'UPDATE' then
    if (new.church_id, new.session_id, new.ministry_id, new.ministry_membership_id)
       is distinct from (old.church_id, old.session_id, old.ministry_id, old.ministry_membership_id) then
      raise exception 'sessão e pessoa da escala são imutáveis' using errcode = '42501';
    end if;
    -- transições válidas (R-11)
    if new.status is distinct from old.status then
      if not ( (old.status = 'draft'     and new.status in ('published','cancelled'))
            or (old.status = 'published' and new.status in ('confirmed','declined','cancelled','draft'))
            or (old.status = 'confirmed' and new.status in ('declined','cancelled'))
            or (old.status = 'declined'  and new.status in ('replaced','cancelled','confirmed'))) then
        raise exception 'transição de escala inválida: % -> %', old.status, new.status using errcode = '23514';
      end if;
      if new.status in ('confirmed','declined') then new.responded_at := now(); end if;
    end if;
    -- membro comum só responde (status/nota); demais campos ficam intactos
    if v_actor is not null and not private.has_ministry_permission(old.church_id, old.ministry_id, 'manage_schedule')
       and new.status in ('confirmed','declined') then
      if (new.function, new.source, new.ai_run_id, new.override_reason)
         is distinct from (old.function, old.source, old.ai_run_id, old.override_reason) then
        raise exception 'o escalado só pode confirmar ou recusar' using errcode = '42501';
      end if;
    end if;
  end if;

  -- publicar exige publish_schedule (R-11)
  if v_actor is not null and new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if not private.has_ministry_permission(new.church_id, new.ministry_id, 'publish_schedule') then
      raise exception 'requer publish_schedule' using errcode = '42501';
    end if;
  end if;

  if new.status in ('draft','published','confirmed') then
    select mm.membership_id into v_person from public.ministry_memberships mm
      where mm.id = new.ministry_membership_id and mm.church_id = new.church_id;
    -- R-09: precisa estar ativo no ministério e na igreja
    if not exists (select 1 from public.ministry_memberships mm
        join public.church_memberships cm on cm.id = mm.membership_id and cm.church_id = mm.church_id
        where mm.id = new.ministry_membership_id and mm.active and cm.status = 'active') then
      raise exception 'pessoa inativa no ministério ou na igreja' using errcode = '23514';
    end if;

    select * into v_session from public.event_sessions s where s.id = new.session_id and s.church_id = new.church_id;
    select c.timezone, st.rotation_policy into v_tz, v_policy
      from public.churches c join public.church_settings st on st.church_id = c.id where c.id = new.church_id;
    v_multi := coalesce((v_policy ->> 'allow_multi_function')::boolean, false);

    -- R-10: indisponibilidade (justificativa de override é auditada)
    if new.override_reason is null
       and private.is_unavailable_on(new.church_id, v_person, (v_session.starts_at at time zone v_tz)::date) then
      raise exception 'pessoa indisponível nesta data' using errcode = '23514';
    end if;

    -- R-07 / R-08: sobreposição com outra escala ativa da mesma pessoa
    select exists (
      select 1
      from public.event_lineup l
      join public.ministry_memberships mm2 on mm2.id = l.ministry_membership_id and mm2.church_id = l.church_id
      join public.event_sessions s2 on s2.id = l.session_id and s2.church_id = l.church_id
      where l.church_id = new.church_id and mm2.membership_id = v_person
        and l.id <> new.id and l.status in ('draft','published','confirmed')
        and (
          (s2.id = new.session_id and not v_multi)
          or (s2.id <> new.session_id and tstzrange(s2.starts_at, s2.ends_at) && tstzrange(v_session.starts_at, v_session.ends_at))
        )
    ) into v_conflict;
    if v_conflict then
      raise exception 'pessoa já escalada em sessão sobreposta' using errcode = '23P01';
    end if;
  end if;
  return new;
end $$;
create trigger trg_event_lineup_guard before insert or update on public.event_lineup
  for each row execute function private.event_lineup_guard();

-- Evento concluído não é excluível; filhos só em cascata enquanto rascunho
create or replace function private.events_delete_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' then raise exception 'apenas eventos em rascunho podem ser excluídos' using errcode = '23514'; end if;
  return old;
end $$;
create trigger trg_events_delete_guard before delete on public.events
  for each row execute function private.events_delete_guard();

-- Disponibilidade para líderes: apenas booleano, nunca o motivo (SECURITY §8, R-10)
create or replace function public.get_ministry_availability(p_session uuid, p_ministry uuid)
returns table (ministry_membership_id uuid, membership_id uuid, available boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_church uuid; v_start timestamptz; v_tz text;
begin
  select s.church_id, s.starts_at into v_church, v_start from public.event_sessions s where s.id = p_session;
  if v_church is null then raise exception 'sessão inexistente' using errcode = 'P0002'; end if;
  if not (private.has_ministry_permission(v_church, p_ministry, 'view_availability')
       or private.has_ministry_permission(v_church, p_ministry, 'manage_schedule')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  select c.timezone into v_tz from public.churches c where c.id = v_church;
  return query
    select mm.id, mm.membership_id,
           not private.is_unavailable_on(v_church, mm.membership_id, (v_start at time zone v_tz)::date)
    from public.ministry_memberships mm
    join public.church_memberships cm on cm.id = mm.membership_id and cm.church_id = mm.church_id
    where mm.church_id = v_church and mm.ministry_id = p_ministry and mm.active and cm.status = 'active';
end $$;
