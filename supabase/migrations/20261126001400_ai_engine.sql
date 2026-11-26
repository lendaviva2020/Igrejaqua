-- Motor de IA (docs/AI_ENGINE.md): registro auditável das execuções e criação de rascunho de escala.
-- Sem service role: tudo via funções SECURITY DEFINER que revalidam permissão. A IA continua consultiva:
-- "aceitar" cria event_lineup em DRAFT; publicar segue exigindo publish_schedule (trigger event_lineup_guard).

create or replace function public.ai_begin_schedule_run(p_session uuid, p_prompt_version text, p_input_digest text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_church uuid; v_ministry uuid; v_enabled boolean; v_consent timestamptz; v_id uuid;
begin
  if v_actor is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if p_prompt_version is null or char_length(p_prompt_version) not between 1 and 40 then
    raise exception 'prompt_version inválida' using errcode = '22023';
  end if;
  select s.church_id, s.ministry_id into v_church, v_ministry from public.event_sessions s where s.id = p_session;
  if v_church is null then raise exception 'sessão inexistente' using errcode = 'P0002'; end if;
  if v_ministry is null then raise exception 'a sessão precisa de um ministério responsável' using errcode = '23514'; end if;
  if not private.has_ministry_permission(v_church, v_ministry, 'manage_schedule') then
    raise exception 'sem permissão para montar escala' using errcode = '42501';
  end if;
  select st.ai_enabled, st.ai_data_sharing_consent_at into v_enabled, v_consent
    from public.church_settings st where st.church_id = v_church;
  if not coalesce(v_enabled, false) or v_consent is null then
    raise exception 'IA desativada para esta igreja' using errcode = '55000';
  end if;
  insert into public.ai_generation_runs (church_id, kind, status, requested_by, target_session_id, input_digest, prompt_version)
    values (v_church, 'schedule', 'pending', v_actor, p_session, p_input_digest, p_prompt_version)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.ai_finish_run(
  p_run uuid, p_status public.ai_run_status, p_model text, p_request_tokens integer, p_response_tokens integer, p_raw jsonb, p_report jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_run public.ai_generation_runs%rowtype;
begin
  if p_status not in ('generated','validated','validation_failed','error') then
    raise exception 'status inválido para finalização' using errcode = '22023';
  end if;
  select * into v_run from public.ai_generation_runs r where r.id = p_run for update;
  if not found or v_run.requested_by is distinct from v_actor then
    raise exception 'execução não encontrada' using errcode = '42501';
  end if;
  if v_run.status not in ('pending','generated') then
    raise exception 'execução já finalizada' using errcode = '23514';
  end if;
  update public.ai_generation_runs
     set status = p_status, model = left(p_model, 80), request_token_count = p_request_tokens,
         response_token_count = p_response_tokens, raw_output = p_raw, validation_report = p_report
   where id = p_run;
end $$;

create or replace function public.ai_accept_schedule_run(p_run uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid()); v_run public.ai_generation_runs%rowtype;
  v_ministry uuid; v_item jsonb; v_count integer := 0;
begin
  select * into v_run from public.ai_generation_runs r where r.id = p_run for update;
  if not found or v_run.kind <> 'schedule' then raise exception 'execução não encontrada' using errcode = '42501'; end if;
  select s.ministry_id into v_ministry from public.event_sessions s
    where s.id = v_run.target_session_id and s.church_id = v_run.church_id;
  if v_ministry is null or not private.has_ministry_permission(v_run.church_id, v_ministry, 'manage_schedule') then
    raise exception 'sem permissão para aceitar sugestão' using errcode = '42501';
  end if;
  if v_run.status <> 'validated' then
    raise exception 'só sugestões validadas podem virar rascunho' using errcode = '23514';
  end if;
  if not exists (select 1 from public.church_settings st where st.church_id = v_run.church_id and st.ai_enabled) then
    raise exception 'IA desativada para esta igreja' using errcode = '55000';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(v_run.validation_report -> 'accepted', '[]'::jsonb)) loop
    -- O trigger event_lineup_guard reaplica R-07..R-10 no momento do aceite (o estado pode ter mudado).
    insert into public.event_lineup (church_id, session_id, ministry_id, ministry_membership_id, function, status, source, ai_run_id, created_by)
      values (v_run.church_id, v_run.target_session_id, v_ministry,
              (v_item ->> 'ministry_membership_id')::uuid, v_item ->> 'function', 'draft', 'ai', p_run, v_actor);
    v_count := v_count + 1;
  end loop;
  update public.ai_generation_runs set status = 'accepted', accepted_at = now() where id = p_run;
  return v_count;
end $$;

create or replace function public.ai_discard_run(p_run uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_run public.ai_generation_runs%rowtype; v_ministry uuid;
begin
  select * into v_run from public.ai_generation_runs r where r.id = p_run for update;
  if not found then raise exception 'execução não encontrada' using errcode = '42501'; end if;
  select s.ministry_id into v_ministry from public.event_sessions s where s.id = v_run.target_session_id and s.church_id = v_run.church_id;
  if not (v_run.requested_by = (select auth.uid()) or (v_ministry is not null and private.has_ministry_permission(v_run.church_id, v_ministry, 'manage_schedule'))) then
    raise exception 'execução não encontrada' using errcode = '42501';
  end if;
  if v_run.status not in ('generated','validated','validation_failed') then
    raise exception 'execução não pode ser descartada' using errcode = '23514';
  end if;
  update public.ai_generation_runs set status = 'discarded' where id = p_run;
end $$;

revoke all on function public.ai_begin_schedule_run(uuid, text, text) from public, anon;
revoke all on function public.ai_finish_run(uuid, public.ai_run_status, text, integer, integer, jsonb, jsonb) from public, anon;
revoke all on function public.ai_accept_schedule_run(uuid) from public, anon;
revoke all on function public.ai_discard_run(uuid) from public, anon;
grant execute on function public.ai_begin_schedule_run(uuid, text, text) to authenticated;
grant execute on function public.ai_finish_run(uuid, public.ai_run_status, text, integer, integer, jsonb, jsonb) to authenticated;
grant execute on function public.ai_accept_schedule_run(uuid) to authenticated;
grant execute on function public.ai_discard_run(uuid) to authenticated;
