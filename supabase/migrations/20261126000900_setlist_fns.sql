-- IGREJAQUA — 0009: reordenação atômica do setlist (constraint de posição é deferrable, mas PostgREST usa 1 transação por chamada)
create or replace function public.reorder_setlist(p_session uuid, p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare v_church uuid; v_count int; v_updated int;
begin
  select s.church_id into v_church from public.event_sessions s where s.id = p_session;
  if v_church is null then raise exception 'sessão inexistente' using errcode = 'P0002'; end if;
  select count(*) into v_count from public.event_setlist where session_id = p_session and church_id = v_church;
  if coalesce(cardinality(p_ids), 0) <> v_count
     or (select count(distinct x) from unnest(p_ids) x) <> v_count
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.event_setlist l where l.id = x and l.session_id = p_session and l.church_id = v_church)) then
    raise exception 'lista de ordenação não corresponde ao setlist' using errcode = '22023';
  end if;
  update public.event_setlist l set position = o.ord - 1, updated_at = now()
    from unnest(p_ids) with ordinality as o(id, ord)
   where l.id = o.id and l.session_id = p_session and l.church_id = v_church;
  get diagnostics v_updated = row_count;
  -- RLS filtra UPDATE em silêncio; sem permissão, nenhuma/poucas linhas mudam e a operação inteira é recusada
  if v_updated <> v_count then raise exception 'sem permissão para reordenar o setlist' using errcode = '42501'; end if;
end $$;

create or replace function public.add_to_setlist(p_session uuid, p_version uuid, p_target_key text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_church uuid; v_id uuid; v_pos smallint;
begin
  select s.church_id into v_church from public.event_sessions s where s.id = p_session;
  if v_church is null then raise exception 'sessão inexistente' using errcode = 'P0002'; end if;
  select coalesce(max(position) + 1, 0) into v_pos from public.event_setlist where session_id = p_session and church_id = v_church;
  insert into public.event_setlist (church_id, session_id, song_version_id, position, target_key)
  values (v_church, p_session, p_version, v_pos, p_target_key) returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.reorder_setlist(uuid, uuid[]), public.add_to_setlist(uuid, uuid, text) from public, anon;
grant execute on function public.reorder_setlist(uuid, uuid[]), public.add_to_setlist(uuid, uuid, text) to authenticated;
