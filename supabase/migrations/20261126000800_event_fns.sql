-- IGREJAQUA — 0008: criação de eventos/sessões com horário local da igreja (SECURITY INVOKER: RLS do chamador vale)
create or replace function public.create_event(
  p_church uuid, p_title text, p_kind public.event_kind,
  p_starts_local timestamp, p_ends_local timestamp, p_location text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_tz text; v_event uuid; v_start timestamptz; v_end timestamptz;
begin
  select c.timezone into v_tz from public.churches c where c.id = p_church;
  if v_tz is null then raise exception 'igreja inexistente' using errcode = 'P0002'; end if;
  v_start := p_starts_local at time zone v_tz;
  v_end := p_ends_local at time zone v_tz;
  insert into public.events (church_id, title, kind, status, starts_at, ends_at, location, created_by)
  values (p_church, btrim(p_title), p_kind, 'scheduled', v_start, v_end, nullif(btrim(coalesce(p_location, '')), ''), (select auth.uid()))
  returning id into v_event;
  insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at, location, position)
  values (p_church, v_event, 'Principal', v_start, v_end, nullif(btrim(coalesce(p_location, '')), ''), 0);
  return v_event;
end $$;

create or replace function public.add_event_session(
  p_event uuid, p_name text, p_starts_local timestamp, p_ends_local timestamp, p_ministry uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_church uuid; v_tz text; v_session uuid; v_pos smallint;
begin
  select e.church_id, c.timezone into v_church, v_tz from public.events e join public.churches c on c.id = e.church_id where e.id = p_event;
  if v_church is null then raise exception 'evento inexistente' using errcode = 'P0002'; end if;
  select coalesce(max(position) + 1, 0) into v_pos from public.event_sessions where event_id = p_event and church_id = v_church;
  insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at, ministry_id, position)
  values (v_church, p_event, btrim(p_name), p_starts_local at time zone v_tz, p_ends_local at time zone v_tz, p_ministry, v_pos)
  returning id into v_session;
  -- mantém a janela do evento cobrindo todas as sessões
  update public.events set starts_at = least(starts_at, p_starts_local at time zone v_tz), ends_at = greatest(ends_at, p_ends_local at time zone v_tz)
   where id = p_event and church_id = v_church;
  return v_session;
end $$;

revoke execute on function public.create_event(uuid, text, public.event_kind, timestamp, timestamp, text), public.add_event_session(uuid, text, timestamp, timestamp, uuid) from public, anon;
grant execute on function public.create_event(uuid, text, public.event_kind, timestamp, timestamp, text), public.add_event_session(uuid, text, timestamp, timestamp, uuid) to authenticated;
