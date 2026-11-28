-- IGREJAQUA — testes SQL do link de referência da música
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
create or replace function tests.eq_text(p_label text, p_actual text, p_expected text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then raise exception 'FALHA [%]: esperado %, obtido %', p_label, p_expected, p_actual; end if;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a9','pastor@ref.test','{"full_name":"Pastor Ref"}'),
 ('00000000-0000-0000-0000-0000000000b9','outro@ref.test','{"full_name":"Outro Ref"}');

select tests.login('00000000-0000-0000-0000-0000000000a9','pastor@ref.test');
set role authenticated;
select public.create_church('Igreja Ref','igreja-ref') as church_ref \gset

-- Com link https: gravado. Chamada antiga (6 argumentos) continua válida, sem link.
select public.create_song(:'church_ref', 'Com vídeo', 'Grupo', 'G', '[G]la', null::smallint, 'https://www.youtube.com/watch?v=abcdefghijk') as song_v \gset
select public.create_song(:'church_ref', 'Sem vídeo', 'Grupo', 'D', '[D]la', null::smallint) as song_s \gset
select tests.eq_text('link gravado', (select reference_url from public.songs where id = :'song_v'), 'https://www.youtube.com/watch?v=abcdefghijk');
select tests.eq_text('chamada antiga sem link', (select coalesce(reference_url, 'nulo') from public.songs where id = :'song_s'), 'nulo');
select public.create_song(:'church_ref', 'Vazio', null, 'E', '', null::smallint, '   ') as song_e \gset
select tests.eq_text('vazio vira nulo', (select coalesce(reference_url, 'nulo') from public.songs where id = :'song_e'), 'nulo');

-- Esquemas perigosos e http são recusados pelo banco.
select tests.denied('javascript: recusado', format($q$select public.create_song(%L,'X',null,'G','',null::smallint,'javascript:alert(1)')$q$, :'church_ref'));
select tests.denied('http recusado', format($q$select public.create_song(%L,'X',null,'G','',null::smallint,'http://exemplo.com')$q$, :'church_ref'));
select tests.denied('aspas recusadas', format($q$select public.create_song(%L,'X',null,'G','',null::smallint,'https://a.com/"onmouseover=x')$q$, :'church_ref'));
select tests.denied('link longo demais', format($q$select public.create_song(%L,'X',null,'G','',null::smallint,%L)$q$, :'church_ref', 'https://a.com/' || repeat('a', 600)));

-- Atualizar o link: gestor pode; pessoa de outra igreja não enxerga nem altera.
update public.songs set reference_url = 'https://youtu.be/abcdefghijk' where id = :'song_s';
select tests.eq_text('gestor atualiza link', (select reference_url from public.songs where id = :'song_s'), 'https://youtu.be/abcdefghijk');

reset role;
select tests.login('00000000-0000-0000-0000-0000000000b9','outro@ref.test');
set role authenticated;
update public.songs set reference_url = 'https://invasor.example/x' where id = :'song_v';
reset role;
select tests.eq_text('outra igreja não altera', (select reference_url from public.songs where id = :'song_v'), 'https://www.youtube.com/watch?v=abcdefghijk');

\echo 'OK 140_song_reference_url'
