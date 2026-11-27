-- IGREJAQUA — testes SQL da IA de repertório (job diário + revisão humana)
\set ON_ERROR_STOP on
create schema if not exists tests;
grant usage on schema tests to authenticated, anon;
create or replace function tests.login(p_uid uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, false);
  perform set_config('request.jwt.claim.email', p_email, false);
end $$;
create or replace function tests.denied(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'FALHA [%]: deveria ter sido negado', p_label;
end $$;
create or replace function tests.eq(p_label text, p_actual bigint, p_expected bigint) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then raise exception 'FALHA [%]: esperado %, obtido %', p_label, p_expected, p_actual; end if;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a8','pastor@rep.test','{"full_name":"Pastor Rep"}'),
 ('00000000-0000-0000-0000-0000000000b8','fiel@rep.test','{"full_name":"Fiel Rep"}');

select tests.login('00000000-0000-0000-0000-0000000000a8','pastor@rep.test');
set role authenticated;
select public.create_church('Igreja Rep','igreja-rep') as church_r \gset
select public.set_church_ai(:'church_r', true, 'termo-v1');
select public.create_song(:'church_r', 'Canção Um', 'Grupo', 'G', '[G]la', null::smallint) as song1 \gset
select public.create_song(:'church_r', 'Canção Dois', 'Grupo', 'D', '[D]la', null::smallint) as song2 \gset
select public.create_song(:'church_r', 'Canção Três', 'Grupo', 'E', '[E]la', null::smallint) as song3 \gset
select public.create_event(:'church_r', 'Culto Rep', 'service', (now() + interval '2 days')::timestamp, (now() + interval '2 days 2 hours')::timestamp) as event_r \gset
reset role;
select s.id as session_r from public.event_sessions s where s.event_id = :'event_r' \gset
select v.id as v1 from public.song_versions v where v.song_id = :'song1' \gset
select v.id as v2 from public.song_versions v where v.song_id = :'song2' \gset
select v.id as v3 from public.song_versions v where v.song_id = :'song3' \gset
insert into public.church_memberships (church_id, user_id, role) values (:'church_r','00000000-0000-0000-0000-0000000000b8','member');

-- ===== funções do job: só service_role =====
select tests.login('00000000-0000-0000-0000-0000000000a8','pastor@rep.test');
set role authenticated;
select tests.denied('usuário não lista sessões do job', $q$select * from public.ai_repertoire_due_sessions(5, 10)$q$);
select tests.denied('usuário não lê contexto do job', format($q$select public.ai_repertoire_context(%L)$q$, :'session_r'));
select tests.denied('usuário não grava execução do job', format($q$select public.ai_repertoire_record(%L,'v','d','m',1,1,'{}','{}','validated')$q$, :'session_r'));
reset role;

set role service_role;
select tests.eq('sessão sem repertório é elegível', (select count(*) from public.ai_repertoire_due_sessions(5, 10) d where d.session_id = :'session_r'), 1);
select tests.eq('contexto traz as 3 músicas', (select jsonb_array_length(public.ai_repertoire_context(:'session_r') -> 'songs')), 3);
select tests.eq('contexto sem pessoas', (select count(*) from jsonb_object_keys(public.ai_repertoire_context(:'session_r')) k where k in ('members','people','lineup')), 0);
select public.ai_repertoire_record(:'session_r', 'repertoire-v1', 'digest', 'modelo', 10, 5, '{}'::jsonb,
  jsonb_build_object('accepted', jsonb_build_array(
    jsonb_build_object('song_version_id', :'v3', 'position', 0, 'title', 'Canção Três', 'artist', null, 'key', 'E', 'reason', null),
    jsonb_build_object('song_version_id', :'v1', 'position', 1, 'title', 'Canção Um', 'artist', null, 'key', 'G', 'reason', null),
    jsonb_build_object('song_version_id', :'v2', 'position', 2, 'title', 'Canção Dois', 'artist', null, 'key', 'D', 'reason', null))),
  'validated') as run_r \gset
select tests.eq('sessão com rascunho deixa de ser elegível', (select count(*) from public.ai_repertoire_due_sessions(5, 10) d where d.session_id = :'session_r'), 0);
reset role;
select tests.eq('execução do sistema sem solicitante', (select count(*) from public.ai_generation_runs where id = :'run_r' and requested_by is null and kind = 'repertoire'), 1);
select tests.eq('pastor notificado', (select count(*) from public.notifications where church_id = :'church_r' and user_id = '00000000-0000-0000-0000-0000000000a8' and category = 'repertorio'), 1);
select tests.eq('membro comum não notificado', (select count(*) from public.notifications where church_id = :'church_r' and user_id = '00000000-0000-0000-0000-0000000000b8' and category = 'repertorio'), 0);

-- ===== revisão humana =====
select tests.login('00000000-0000-0000-0000-0000000000b8','fiel@rep.test');
set role authenticated;
select tests.eq('membro comum não vê a sugestão', (select count(*) from public.ai_generation_runs where id = :'run_r'), 0);
select tests.denied('membro comum não aceita', format($q$select public.ai_accept_repertoire_run(%L)$q$, :'run_r'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a8','pastor@rep.test');
set role authenticated;
select tests.eq('aceite cria 3 músicas', public.ai_accept_repertoire_run(:'run_r'), 3);
select tests.eq('ordem da IA preservada', (select count(*) from public.event_setlist where session_id = :'session_r' and ((position = 0 and song_version_id = :'v3') or (position = 1 and song_version_id = :'v1') or (position = 2 and song_version_id = :'v2'))), 3);
select tests.denied('não aceita duas vezes', format($q$select public.ai_accept_repertoire_run(%L)$q$, :'run_r'));
reset role;
select tests.eq('execução marcada como aceita', (select count(*) from public.ai_generation_runs where id = :'run_r' and status = 'accepted'), 1);

-- ===== sugestão inválida não vira repertório =====
set role service_role;
select public.ai_repertoire_record(:'session_r', 'repertoire-v1', 'digest2', 'modelo', 10, 5, '{}'::jsonb, '{"accepted":[]}'::jsonb, 'validation_failed') as run_bad \gset
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a8','pastor@rep.test');
set role authenticated;
select tests.denied('reprovada não é aceita', format($q$select public.ai_accept_repertoire_run(%L)$q$, :'run_bad'));
select public.ai_discard_repertoire_run(:'run_bad');
reset role;
select tests.eq('reprovada descartada', (select count(*) from public.ai_generation_runs where id = :'run_bad' and status = 'discarded'), 1);
