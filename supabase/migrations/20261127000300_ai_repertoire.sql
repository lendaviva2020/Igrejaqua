-- IGREJAQUA — IA de repertório (decisão do responsável, 2026-11-27):
-- um job diário (rota /api/cron/repertoire, service role) encontra cultos/ensaios dos próximos dias SEM repertório,
-- pede à IA uma sugestão usando SOMENTE músicas já cadastradas pela igreja (com cifra própria) e sugestões de
-- músicas novas para aprender (só título/artista, nunca letra ou cifra). Tudo fica como RASCUNHO em
-- ai_generation_runs; o setlist só existe depois que alguém com manage_repertoire/manage_schedule aceita.
-- Nenhum dado pessoal vai ao provedor: só títulos, tons, andamentos, tags e a referência bíblica do devocional.

-- Execuções do sistema (job agendado) não têm solicitante.
alter table public.ai_generation_runs alter column requested_by drop not null;

-- ---------- Funções do job (somente service_role) ----------

-- Sessões elegíveis: começam nos próximos p_days, evento agendado e não-reunião, igreja ativa com IA ligada e
-- consentida, setlist vazio e sem execução de repertório anterior (exceto erro há mais de 20 h, que é refeita).
create or replace function public.ai_repertoire_due_sessions(p_days integer, p_limit integer)
returns table (session_id uuid, church_id uuid)
language sql stable security definer set search_path = '' as $$
  select s.id, s.church_id
    from public.event_sessions s
    join public.events e on e.church_id = s.church_id and e.id = s.event_id
    join public.churches c on c.id = s.church_id
    join public.church_settings st on st.church_id = s.church_id
   where s.starts_at > now()
     and s.starts_at <= now() + make_interval(days => greatest(1, least(p_days, 14)))
     and e.status = 'scheduled' and e.deleted_at is null and e.kind <> 'meeting'
     and c.status = 'active' and st.ai_enabled and st.ai_data_sharing_consent_at is not null
     and not exists (select 1 from public.event_setlist l where l.church_id = s.church_id and l.session_id = s.id)
     and not exists (select 1 from public.ai_generation_runs r
                      where r.church_id = s.church_id and r.target_session_id = s.id and r.kind = 'repertoire'
                        and (r.status <> 'error' or r.created_at > now() - interval '20 hours'))
   order by s.starts_at
   limit greatest(1, least(p_limit, 25));
$$;

-- Contexto mínimo para a IA (sem pessoas): dados da sessão, tema do devocional mais recente e músicas elegíveis
-- (versão padrão publicada de cada música ativa), com quantos dias faz que cada uma foi usada.
create or replace function public.ai_repertoire_context(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_s record; v_theme jsonb; v_songs jsonb;
begin
  select s.id, s.church_id, s.name, s.starts_at, s.ends_at, e.title as event_title, e.kind, c.timezone
    into v_s
    from public.event_sessions s join public.events e on e.church_id = s.church_id and e.id = s.event_id
    join public.churches c on c.id = s.church_id
   where s.id = p_session;
  if not found then return null; end if;

  select jsonb_build_object('title', a.title, 'scripture_ref', a.scripture_ref)
    into v_theme
    from public.announcements_and_devotionals a
   where a.church_id = v_s.church_id and a.kind = 'devotional' and a.status = 'published' and a.deleted_at is null
     and a.audience = 'church'
   order by a.published_at desc nulls last limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'version_id', v.id, 'title', so.title, 'artist', so.artist, 'key', v.original_key, 'bpm', v.bpm,
           'duration_s', v.duration_s, 'tags', so.tags,
           'last_used_days', (select floor(extract(epoch from (now() - max(ss.starts_at))) / 86400)::integer
                                from public.event_setlist l join public.song_versions v2 on v2.church_id = l.church_id and v2.id = l.song_version_id
                                join public.event_sessions ss on ss.church_id = l.church_id and ss.id = l.session_id
                               where l.church_id = v_s.church_id and v2.song_id = so.id and ss.starts_at < now()))
           order by so.title), '[]'::jsonb)
    into v_songs
    from public.songs so
    join public.song_versions v on v.church_id = so.church_id and v.song_id = so.id
   where so.church_id = v_s.church_id and so.deleted_at is null
     and v.is_default and v.status = 'published' and v.deleted_at is null;

  return jsonb_build_object(
    'session_id', v_s.id, 'church_id', v_s.church_id, 'session_name', v_s.name, 'event_title', v_s.event_title,
    'event_kind', v_s.kind, 'starts_local', to_char(v_s.starts_at at time zone v_s.timezone, 'YYYY-MM-DD"T"HH24:MI'),
    'duration_min', floor(extract(epoch from (v_s.ends_at - v_s.starts_at)) / 60)::integer,
    'theme', v_theme, 'songs', v_songs);
end $$;

-- Registra a execução do job (rascunho). Notifica quem pode montar o setlist quando a sugestão é válida.
create or replace function public.ai_repertoire_record(
  p_session uuid, p_prompt_version text, p_input_digest text, p_model text, p_request_tokens integer,
  p_response_tokens integer, p_raw jsonb, p_report jsonb, p_status public.ai_run_status)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_church uuid; v_event uuid; v_session_name text; v_event_title text; v_id uuid; v_user uuid;
begin
  if p_status not in ('validated','validation_failed','error') then
    raise exception 'status inválido para o job de repertório' using errcode = '22023';
  end if;
  select s.church_id, s.event_id, s.name, e.title into v_church, v_event, v_session_name, v_event_title
    from public.event_sessions s join public.events e on e.church_id = s.church_id and e.id = s.event_id where s.id = p_session;
  if v_church is null then raise exception 'sessão inexistente' using errcode = 'P0002'; end if;
  insert into public.ai_generation_runs (church_id, kind, status, requested_by, target_session_id, input_digest, prompt_version,
                                         model, request_token_count, response_token_count, raw_output, validation_report)
  values (v_church, 'repertoire', p_status, null, p_session, left(p_input_digest, 128), left(p_prompt_version, 40),
          left(p_model, 80), p_request_tokens, p_response_tokens, p_raw, p_report)
  returning id into v_id;

  if p_status = 'validated' then
    for v_user in
      select distinct cm.user_id
        from public.church_memberships cm
       where cm.church_id = v_church and cm.status = 'active'
         and (cm.role = 'admin' or exists (
               select 1 from public.ministry_memberships mm
                 join public.ministry_permissions mp on mp.church_id = mm.church_id and mp.ministry_membership_id = mm.id
                where mm.church_id = cm.church_id and mm.membership_id = cm.id and mm.active
                  and mp.permission in ('manage_repertoire','manage_schedule')))
    loop
      perform private.notify(v_church, v_user, 'repertorio', 'Sugestão de repertório pronta',
        format('A IA sugeriu um repertório para %s · %s. Revise e aceite ou descarte.', v_event_title, v_session_name),
        '/agenda/' || v_event::text, 'ai-repertoire:' || v_id::text);
    end loop;
  end if;
  return v_id;
end $$;

-- ---------- Revisão humana (usuário com manage_repertoire ou manage_schedule — mesma regra do setlist) ----------

create or replace function public.ai_accept_repertoire_run(p_run uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_run public.ai_generation_runs%rowtype; v_item jsonb; v_pos smallint := 0;
begin
  select * into v_run from public.ai_generation_runs r where r.id = p_run for update;
  if not found or v_run.kind <> 'repertoire' then raise exception 'execução não encontrada' using errcode = '42501'; end if;
  if not private.has_any_ministry_permission(v_run.church_id, array['manage_repertoire','manage_schedule']::public.ministry_permission[]) then
    raise exception 'sem permissão para montar o repertório' using errcode = '42501';
  end if;
  if v_run.status <> 'validated' then raise exception 'só sugestões validadas podem virar repertório' using errcode = '23514'; end if;
  if exists (select 1 from public.event_setlist l where l.church_id = v_run.church_id and l.session_id = v_run.target_session_id) then
    raise exception 'esta sessão já tem repertório; descarte a sugestão ou monte manualmente' using errcode = '23514';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(v_run.validation_report -> 'accepted', '[]'::jsonb)) loop
    -- revalida no aceite: a versão precisa continuar publicada e ativa nesta igreja
    if not exists (select 1 from public.song_versions v join public.songs so on so.church_id = v.church_id and so.id = v.song_id
                    where v.church_id = v_run.church_id and v.id = (v_item ->> 'song_version_id')::uuid
                      and v.status = 'published' and v.deleted_at is null and so.deleted_at is null) then
      raise exception 'uma das músicas sugeridas não está mais disponível' using errcode = '23514';
    end if;
    insert into public.event_setlist (church_id, session_id, song_version_id, position)
      values (v_run.church_id, v_run.target_session_id, (v_item ->> 'song_version_id')::uuid, v_pos);
    v_pos := v_pos + 1;
  end loop;
  update public.ai_generation_runs set status = 'accepted', accepted_at = now() where id = p_run;
  insert into public.audit_logs (church_id, actor_user_id, actor_membership_id, action, entity_table, entity_id, diff)
    values (v_run.church_id, (select auth.uid()), private.current_membership_id(v_run.church_id), 'accept_ai',
            'ai_generation_runs', p_run::text, jsonb_build_object('songs', v_pos));
  return v_pos;
end $$;

create or replace function public.ai_discard_repertoire_run(p_run uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_run public.ai_generation_runs%rowtype;
begin
  select * into v_run from public.ai_generation_runs r where r.id = p_run for update;
  if not found or v_run.kind <> 'repertoire' then raise exception 'execução não encontrada' using errcode = '42501'; end if;
  if not private.has_any_ministry_permission(v_run.church_id, array['manage_repertoire','manage_schedule']::public.ministry_permission[]) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_run.status not in ('validated','validation_failed') then raise exception 'execução não pode ser descartada' using errcode = '23514'; end if;
  update public.ai_generation_runs set status = 'discarded' where id = p_run;
end $$;

revoke all on function public.ai_repertoire_due_sessions(integer, integer), public.ai_repertoire_context(uuid),
  public.ai_repertoire_record(uuid, text, text, text, integer, integer, jsonb, jsonb, public.ai_run_status)
  from public, anon, authenticated;
grant execute on function public.ai_repertoire_due_sessions(integer, integer), public.ai_repertoire_context(uuid),
  public.ai_repertoire_record(uuid, text, text, text, integer, integer, jsonb, jsonb, public.ai_run_status) to service_role;
revoke all on function public.ai_accept_repertoire_run(uuid), public.ai_discard_repertoire_run(uuid) from public, anon;
grant execute on function public.ai_accept_repertoire_run(uuid), public.ai_discard_repertoire_run(uuid) to authenticated;
