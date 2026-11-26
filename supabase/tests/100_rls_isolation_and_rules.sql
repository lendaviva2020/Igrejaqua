-- IGREJAQUA — testes SQL de RLS, isolamento de tenant e regras de domínio.
-- Roda como superusuário e alterna para `authenticated` (como o PostgREST/Supabase faz).
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
  begin
    execute p_sql;
  exception when others then
    return; -- negado como esperado (erro de privilégio, RLS, FK, trigger…)
  end;
  raise exception 'FALHA [%]: deveria ter sido negado', p_label;
end $$;

create or replace function tests.eq(p_label text, p_actual bigint, p_expected bigint) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALHA [%]: esperado %, obtido %', p_label, p_expected, p_actual;
  end if;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------- Setup (superusuário) ----------
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','a1@a.test','{"full_name":"Ana Admin A"}'),
 ('00000000-0000-0000-0000-0000000000a2','a2@a.test','{"full_name":"Membro A2"}'),
 ('00000000-0000-0000-0000-0000000000a3','a3@a.test','{"full_name":"Lider A3"}'),
 ('00000000-0000-0000-0000-0000000000b1','b1@b.test','{"full_name":"Bia Admin B"}'),
 ('00000000-0000-0000-0000-0000000000a4','a4@a.test','{"full_name":"Membro A4 sem escala"}');
select tests.eq('perfil criado por trigger', (select count(*) from public.profiles), 5);

-- ---------- Criação de igrejas ----------
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select public.create_church('Igreja A','igreja-a') as church_a \gset
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select public.create_church('Igreja B','igreja-b') as church_b \gset
select tests.denied('slug inválido', $q$select public.create_church('X','Slug Inválido!')$q$);
reset role;

-- ---------- Convites ----------
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
insert into public.church_invitations (church_id, email, role, token_hash, invited_by) values
 (:'church_a','a2@a.test','member', encode(extensions.digest('tok-a2','sha256'),'hex'), '00000000-0000-0000-0000-0000000000a1'),
 (:'church_a','a3@a.test','leader', encode(extensions.digest('tok-a3','sha256'),'hex'), '00000000-0000-0000-0000-0000000000a1');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.denied('convite de outro e-mail', $q$select public.accept_invitation('tok-a3')$q$);
select tests.denied('token inexistente', $q$select public.accept_invitation('nada')$q$);
select public.accept_invitation('tok-a2') is not null as aceito_a2 \gset
select tests.denied('convite reutilizado', $q$select public.accept_invitation('tok-a2')$q$);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select public.accept_invitation('tok-a3') is not null as aceito_a3 \gset
reset role;

-- ---------- Ministério e permissões (admin) ----------
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
insert into public.ministries (church_id, name, slug) values (:'church_a','Louvor','louvor') returning id as min_a \gset
insert into public.ministry_memberships (church_id, ministry_id, membership_id, role, instruments)
  select :'church_a', :'min_a', id, 'coordinator', '{violão}' from public.church_memberships
  where church_id = :'church_a' and user_id = '00000000-0000-0000-0000-0000000000a3' returning id as mm_a3 \gset
insert into public.ministry_memberships (church_id, ministry_id, membership_id, role, instruments)
  select :'church_a', :'min_a', id, 'member', '{voz}' from public.church_memberships
  where church_id = :'church_a' and user_id = '00000000-0000-0000-0000-0000000000a2' returning id as mm_a2 \gset
insert into public.ministry_permissions (church_id, ministry_id, ministry_membership_id, permission)
  select :'church_a', :'min_a', :'mm_a3', p from unnest(array['manage_schedule','publish_schedule','manage_repertoire','view_availability','manage_content']::public.ministry_permission[]) p;
select tests.eq('admin enxerga auditoria', (select count(*) > 0)::int, 1) from public.audit_logs;
reset role;

insert into public.church_memberships (church_id, user_id, role, status) values (:'church_a','00000000-0000-0000-0000-0000000000a4','member','active');

-- ---------- ISOLAMENTO ENTRE IGREJAS ----------
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.eq('B não lê igreja A', (select count(*) from public.churches where id = :'church_a'), 0);
select tests.eq('B não lê vínculos de A', (select count(*) from public.church_memberships where church_id = :'church_a'), 0);
select tests.eq('B não lê ministérios de A', (select count(*) from public.ministries where church_id = :'church_a'), 0);
select tests.eq('B não lê ministry_memberships de A', (select count(*) from public.ministry_memberships where church_id = :'church_a'), 0);
select tests.eq('B não lê permissões de A', (select count(*) from public.ministry_permissions where church_id = :'church_a'), 0);
select tests.eq('B não lê convites de A', (select count(*) from public.church_invitations where church_id = :'church_a'), 0);
select tests.eq('B não lê auditoria de A', (select count(*) from public.audit_logs where church_id = :'church_a'), 0);
select tests.denied('B insere ministério em A', format($q$insert into public.ministries (church_id,name,slug) values (%L,'Invasor','invasor')$q$, :'church_a'));
with u as (update public.churches set name='hack' where id = :'church_a' returning 1) select tests.eq('B update em A afeta 0 linhas', (select count(*) from u), 0);
with u as (update public.church_memberships set role='admin' where church_id = :'church_a' returning 1) select tests.eq('B update de vínculo em A afeta 0 linhas', (select count(*) from u), 0);
select tests.eq('B diretório de A vazio', (select count(*) from public.church_directory(:'church_a')), 0);
reset role;
-- ---------- Papéis: membro comum ----------
select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.denied('membro cria ministério', format($q$insert into public.ministries (church_id,name,slug) values (%L,'Meu','meu')$q$, :'church_a'));
select tests.denied('membro cria música', format($q$insert into public.songs (church_id,title) values (%L,'Teste')$q$, :'church_a'));
with u as (update public.church_memberships set role='admin' where church_id = :'church_a' and user_id='00000000-0000-0000-0000-0000000000a2' returning 1) select tests.eq('membro não consegue se promover (0 linhas)', (select count(*) from u), 0);
select tests.eq('membro não lê auditoria', (select count(*) from public.audit_logs), 0);
select tests.eq('membro não lê convites', (select count(*) from public.church_invitations), 0);
select tests.denied('membro cria evento', format($q$insert into public.events (church_id,title,starts_at,ends_at) values (%L,'x',now(),now()+interval '1h')$q$, :'church_a'));
select tests.denied('membro concede permissão', format($q$insert into public.ministry_permissions (church_id,ministry_id,ministry_membership_id,permission) values (%L,%L,%L,'manage_schedule')$q$, :'church_a', :'min_a', :'mm_a2'));
select tests.denied('membro executa rate_limit_hit', $q$select public.rate_limit_hit('k',1,1)$q$);
select tests.denied('membro lê rate_limit_buckets', $q$select * from public.rate_limit_buckets$q$);
select tests.eq('membro vê diretório', (select count(*) from public.church_directory(:'church_a')), 4);
reset role;

-- ---------- Anti-escalada de líder ----------
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.denied('líder concede a si mesmo', format($q$insert into public.ministry_permissions (church_id,ministry_id,ministry_membership_id,permission) values (%L,%L,%L,'manage_members')$q$, :'church_a', :'min_a', :'mm_a3'));
select tests.denied('líder concede o que não tem', format($q$insert into public.ministry_permissions (church_id,ministry_id,ministry_membership_id,permission) values (%L,%L,%L,'manage_rehearsals')$q$, :'church_a', :'min_a', :'mm_a2'));
reset role;

-- ---------- Música: criação atômica respeita permissões ----------
select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.denied('membro cria música via função', format($q$select public.create_song(%L,'Teste',null,'G','[G]a'::text)$q$, :'church_a'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select public.create_song(:'church_a','Grande é o Senhor','Autor','G','[G]Grande é o [D]Senhor') as song_a \gset
select tests.eq('música + versão padrão criadas', (select count(*) from public.song_versions where song_id = :'song_a' and is_default and status='published'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.eq('outra igreja não vê a música', (select count(*) from public.songs), 0);
select tests.denied('outra igreja cria música em A', format($q$select public.create_song(%L,'Invasora',null,'G','x'::text)$q$, :'church_a'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('membro comum lê a música publicada', (select count(*) from public.songs where id = :'song_a'), 1);
reset role;

-- ---------- Escala: evento, sessões, regras ----------
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
insert into public.events (church_id, title, kind, status, starts_at, ends_at, created_by)
  values (:'church_a','Culto de Domingo','service','scheduled','2027-03-07 09:00-03','2027-03-07 12:00-03','00000000-0000-0000-0000-0000000000a3') returning id as ev_a \gset
insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at, ministry_id) values
  (:'church_a', :'ev_a', 'Ensaio', '2027-03-07 09:00-03','2027-03-07 10:30-03', :'min_a') returning id as s1 \gset
insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at, ministry_id) values
  (:'church_a', :'ev_a', 'Culto', '2027-03-07 10:00-03','2027-03-07 12:00-03', :'min_a') returning id as s2 \gset
insert into public.event_lineup (church_id, session_id, ministry_id, ministry_membership_id, function, created_by)
  values (:'church_a', :'s1', :'min_a', :'mm_a2', 'voz', '00000000-0000-0000-0000-0000000000a3') returning id as l1 \gset
select tests.denied('sobreposição de sessões (R-07)', format($q$insert into public.event_lineup (church_id,session_id,ministry_id,ministry_membership_id,function,created_by) values (%L,%L,%L,%L,'voz','00000000-0000-0000-0000-0000000000a3')$q$, :'church_a', :'s2', :'min_a', :'mm_a2'));
select tests.denied('duas funções na mesma sessão (R-08)', format($q$insert into public.event_lineup (church_id,session_id,ministry_id,ministry_membership_id,function,created_by) values (%L,%L,%L,%L,'violão','00000000-0000-0000-0000-0000000000a3')$q$, :'church_a', :'s1', :'min_a', :'mm_a2'));
reset role;

-- membro não vê rascunho; vê após publicar
select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.eq('escalado vê o próprio rascunho', (select count(*) from public.event_lineup where id = :'l1'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('membro NÃO escalado não vê rascunho', (select count(*) from public.event_lineup where id = :'l1'), 0);
select tests.eq('membro NÃO escalado não vê evento de rascunho/escala alheia sem publicar', (select count(*) from public.event_lineup), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.eq('admin vê rascunho', (select count(*) from public.event_lineup where id = :'l1'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
update public.event_lineup set status = 'published' where id = :'l1';
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('membro NÃO escalado vê escala publicada', (select count(*) from public.event_lineup where id = :'l1'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.denied('transição inválida published->replaced', format($q$update public.event_lineup set status='replaced' where id=%L$q$, :'l1'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.denied('escalado altera função', format($q$update public.event_lineup set function='bateria', status='confirmed' where id=%L$q$, :'l1'));
update public.event_lineup set status = 'confirmed' where id = :'l1';
select tests.eq('escalado confirmou', (select count(*) from public.event_lineup where id = :'l1' and status = 'confirmed' and responded_at is not null), 1);
with d as (delete from public.event_lineup where id = :'l1' returning 1) select tests.eq('escalado não remove escala (0 linhas)', (select count(*) from d), 0);
reset role;

-- ---------- Notificações e comunicados ----------
select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.eq('escalado recebeu notificação ao publicar', (select count(*) from public.notifications where category = 'escala' and link_path like '/agenda/%'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('outro membro não vê notificação alheia', (select count(*) from public.notifications), 0);
select tests.denied('membro cria comunicado', format($q$insert into public.announcements_and_devotionals (church_id,kind,title,body_md,audience,status) values (%L,'announcement','X','y','church','published')$q$, :'church_a'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
insert into public.announcements_and_devotionals (church_id, kind, title, body_md, audience, status, author_membership_id)
  values (:'church_a','announcement','Rascunho interno','texto','church','draft', private.current_membership_id(:'church_a')) returning id as c_draft \gset
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('membro não vê rascunho de comunicado', (select count(*) from public.announcements_and_devotionals where id = :'c_draft'), 0);
select tests.eq('rascunho não notifica', (select count(*) from public.notifications where category = 'comunicado'), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
update public.announcements_and_devotionals set status = 'published' where id = :'c_draft';
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('membro vê comunicado publicado', (select count(*) from public.announcements_and_devotionals where id = :'c_draft'), 1);
select tests.eq('membro foi notificado do comunicado', (select count(*) from public.notifications where category = 'comunicado'), 1);
update public.notifications set read_at = now() where category = 'comunicado';
select tests.eq('membro marcou como lida', (select count(*) from public.notifications where category = 'comunicado' and read_at is not null), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.eq('autor não notifica a si mesmo', (select count(*) from public.notifications where category = 'comunicado'), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
insert into public.notification_preferences (church_id, user_id, category, channel, enabled) values (:'church_a', '00000000-0000-0000-0000-0000000000a4', 'devocional', 'in_app', false);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
insert into public.announcements_and_devotionals (church_id, kind, title, body_md, audience, status, author_membership_id, scripture_ref)
  values (:'church_a','devotional','Devocional da semana','texto','church','published', private.current_membership_id(:'church_a'), 'Hebreus 10:23');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('preferência in_app desligada suprime a notificação', (select count(*) from public.notifications where category = 'devocional'), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.eq('outra igreja não vê comunicado nem notificação', (select count(*) from public.announcements_and_devotionals) + (select count(*) from public.notifications), 0);
reset role;

-- ---------- Cobranças Pix ----------
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
insert into public.pix_charges (church_id, membership_id, purpose, amount_cents) values (:'church_a', private.current_membership_id(:'church_a'), 'oferta', 5000) returning id as pix_a4 \gset
select tests.denied('cobrança em nome de outro membro', format($q$insert into public.pix_charges (church_id, membership_id, purpose, amount_cents) values (%L, %L, 'oferta', 5000)$q$, :'church_a', :'mm_a2'));
select tests.denied('valor abaixo do mínimo', format($q$insert into public.pix_charges (church_id, membership_id, purpose, amount_cents) values (%L, private.current_membership_id(%L), 'oferta', 50)$q$, :'church_a', :'church_a'));
select tests.denied('cliente não define status', format($q$update public.pix_charges set status = 'approved' where id = %L$q$, :'pix_a4'));
select tests.denied('cliente não grava provider_payment_id', format($q$insert into public.pix_charges (church_id, membership_id, purpose, amount_cents, provider_payment_id) values (%L, private.current_membership_id(%L), 'oferta', 5000, '1')$q$, :'church_a', :'church_a'));
select tests.eq('pagador vê a própria cobrança', (select count(*) from public.pix_charges), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.eq('outro membro NÃO vê cobrança alheia', (select count(*) from public.pix_charges), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.eq('líder (não admin) NÃO vê cobranças', (select count(*) from public.pix_charges), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.eq('admin vê cobranças da igreja', (select count(*) from public.pix_charges), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.eq('admin de outra igreja não vê', (select count(*) from public.pix_charges), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
select tests.eq('mudanças de cobrança são auditadas (só nomes de colunas)', (select count(*) from public.audit_logs where entity_table = 'pix_charges'), 1);

-- ---------- Eventos: função respeita permissão e fuso da igreja ----------
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.denied('membro cria evento via função', format($q$select public.create_event(%L,'X','service','2027-04-04 09:00','2027-04-04 11:00')$q$, :'church_a'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select public.create_event(:'church_a','Culto Páscoa','service','2027-04-04 09:00','2027-04-04 11:00','Templo') as ev_c \gset
select tests.eq('horário local 09:00 (UTC-3) = 12:00Z', (select count(*) from public.events where id = :'ev_c' and starts_at = '2027-04-04 12:00:00+00'), 1);
select tests.eq('sessão principal criada', (select count(*) from public.event_sessions where event_id = :'ev_c'), 1);
select public.add_event_session(:'ev_c','Ensaio','2027-04-04 07:30','2027-04-04 08:30', :'min_a') as s_c2 \gset
select tests.eq('janela do evento cobre a nova sessão', (select count(*) from public.events where id = :'ev_c' and starts_at = '2027-04-04 10:30:00+00'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.denied('outra igreja adiciona sessão', format($q$select public.add_event_session(%L,'Invasora','2027-04-04 07:30','2027-04-04 08:30')$q$, :'ev_c'));
reset role;

-- ---------- Setlist: ordenação atômica e RSVP ----------
select id as ver_a from public.song_versions where song_id = :'song_a' and is_default \gset
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select public.create_song(:'church_a','Segunda música','Autor','D','[D]Teste') as song_a2 \gset
select id as ver_a2 from public.song_versions where song_id = :'song_a2' \gset
select public.add_to_setlist(:'s_c2', :'ver_a') as sl1 \gset
select public.add_to_setlist(:'s_c2', :'ver_a2', 'E') as sl2 \gset
select tests.eq('setlist com 2 itens em posições 0 e 1', (select count(*) from public.event_setlist where session_id = :'s_c2' and position in (0,1)), 2);
select public.reorder_setlist(:'s_c2', array[:'sl2', :'sl1']::uuid[]);
select tests.eq('reordenação inverte sem violar unicidade', (select count(*) from public.event_setlist where session_id = :'s_c2' and position = 0 and id = :'sl2'), 1);
select tests.denied('reordenação com ids faltando', format($q$select public.reorder_setlist(%L, array[%L]::uuid[])$q$, :'s_c2', :'sl1'));
select tests.denied('reordenação com id repetido', format($q$select public.reorder_setlist(%L, array[%L,%L]::uuid[])$q$, :'s_c2', :'sl1', :'sl1'));
select tests.denied('música duplicada na mesma sessão', format($q$select public.add_to_setlist(%L, %L)$q$, :'s_c2', :'ver_a'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.denied('membro comum não monta setlist', format($q$select public.add_to_setlist(%L, %L)$q$, :'s_c2', :'ver_a2'));
select tests.eq('membro lê o setlist', (select count(*) from public.event_setlist where session_id = :'s_c2'), 2);
select tests.denied('membro não reordena', format($q$select public.reorder_setlist(%L, array[%L,%L]::uuid[])$q$, :'s_c2', :'sl1', :'sl2'));
insert into public.event_rsvps (church_id, session_id, membership_id, status) select :'church_a', :'s_c2', private.current_membership_id(:'church_a'), 'going';
select tests.eq('RSVP próprio gravado', (select count(*) from public.event_rsvps where session_id = :'s_c2'), 1);
select tests.denied('RSVP em nome de outro', format($q$insert into public.event_rsvps (church_id, session_id, membership_id, status) values (%L, %L, %L, 'going')$q$, :'church_a', :'s_c2', :'mm_a2'));
reset role;

-- ---------- Indisponibilidade: motivo privado; líder só vê booleano ----------
select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
insert into public.unavailabilities (church_id, membership_id, during, reason)
  values (:'church_a', private.current_membership_id(:'church_a'), '[2027-03-14,2027-03-15)', 'consulta médica');
select tests.eq('titular vê a própria indisponibilidade', (select count(*) from public.unavailabilities), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.eq('líder NÃO lê tabela de indisponibilidades', (select count(*) from public.unavailabilities), 0);
insert into public.events (church_id, title, kind, status, starts_at, ends_at, created_by)
  values (:'church_a','Culto 14/03','service','scheduled','2027-03-14 09:00-03','2027-03-14 12:00-03','00000000-0000-0000-0000-0000000000a3') returning id as ev_b \gset
insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at, ministry_id)
  values (:'church_a', :'ev_b', 'Culto', '2027-03-14 10:00-03','2027-03-14 12:00-03', :'min_a') returning id as s3 \gset
select tests.eq('líder vê booleano de disponibilidade (A2 indisponível)', (select count(*) from public.get_ministry_availability(:'s3', :'min_a') where membership_id = (select membership_id from public.ministry_memberships where id = :'mm_a2') and not available), 1);
select tests.denied('escalar indisponível (R-10)', format($q$insert into public.event_lineup (church_id,session_id,ministry_id,ministry_membership_id,function,created_by) values (%L,%L,%L,%L,'voz','00000000-0000-0000-0000-0000000000a3')$q$, :'church_a', :'s3', :'min_a', :'mm_a2'));
insert into public.event_lineup (church_id, session_id, ministry_id, ministry_membership_id, function, override_reason, created_by)
  values (:'church_a', :'s3', :'min_a', :'mm_a2', 'voz', 'substituição de última hora aprovada', '00000000-0000-0000-0000-0000000000a3');
reset role;
select tests.eq('motivo nunca aparece na auditoria', (select count(*) from public.audit_logs where diff::text ilike '%consulta%'), 0);

-- ---------- Oração anônima ----------
select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select public.create_prayer_request(:'church_a', 'Preciso de oração pela minha família', true) as pr_anon \gset
select tests.eq('autor lê o próprio vínculo', (select count(*) from public.prayer_request_authors where prayer_request_id = :'pr_anon'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.eq('admin lê o pedido', (select count(*) from public.prayer_requests where id = :'pr_anon'), 1);
select tests.eq('pedido anônimo sem autor público', (select count(*) from public.prayer_requests where id = :'pr_anon' and public_author_membership_id is null), 1);
select tests.eq('admin NÃO lê autor', (select count(*) from public.prayer_request_authors), 0);
select tests.denied('admin insere autor', format($q$insert into public.prayer_request_authors (prayer_request_id,church_id,membership_id) values (%L,%L,private.current_membership_id(%L))$q$, :'pr_anon', :'church_a', :'church_a'));
select tests.denied('admin edita pedido direto', format($q$update public.prayer_requests set body='x' where id=%L$q$, :'pr_anon'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.eq('líder NÃO lê autor', (select count(*) from public.prayer_request_authors), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.eq('outra igreja não lê oração', (select count(*) from public.prayer_requests), 0);
reset role;

-- ---------- Último admin / auto-promoção ----------
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.denied('admin rebaixa a si mesmo', format($q$update public.church_memberships set role='member', is_owner=false where church_id=%L and user_id='00000000-0000-0000-0000-0000000000a1'$q$, :'church_a'));
reset role;
select tests.denied('remover último admin (service)', format($q$update public.church_memberships set status='left' where church_id=%L and user_id='00000000-0000-0000-0000-0000000000a1'$q$, :'church_a'));

-- ---------- Integrantes de ministério: quem pode gerenciar ----------
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.denied('líder sem manage_members adiciona integrante', format($q$insert into public.ministry_memberships (church_id,ministry_id,membership_id) select %L,%L,id from public.church_memberships where church_id=%L and user_id='00000000-0000-0000-0000-0000000000a4'$q$, :'church_a', :'min_a', :'church_a'));
reset role;

select id as mem_b from public.church_memberships where church_id = :'church_b' limit 1 \gset
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
insert into public.ministry_memberships (church_id, ministry_id, membership_id, role, instruments, voice_part)
  select :'church_a', :'min_a', id, 'member', '{teclado}', 'tenor' from public.church_memberships
  where church_id = :'church_a' and user_id = '00000000-0000-0000-0000-0000000000a4' returning id as mm_a4 \gset
select tests.denied('integrante duplicado', format($q$insert into public.ministry_memberships (church_id,ministry_id,membership_id) select %L,%L,id from public.church_memberships where church_id=%L and user_id='00000000-0000-0000-0000-0000000000a4'$q$, :'church_a', :'min_a', :'church_a'));
select tests.denied('integrante de outra igreja (FK composta)', format($q$insert into public.ministry_memberships (church_id,ministry_id,membership_id) values (%L,%L,%L)$q$, :'church_a', :'min_a', :'mem_b'));
update public.ministry_memberships set instruments = '{teclado,violão}', role = 'coordinator' where id = :'mm_a4';
reset role;
select tests.eq('admin atualizou integrante', (select count(*) from public.ministry_memberships where id = :'mm_a4' and role = 'coordinator' and instruments = '{teclado,violão}'), 1);

select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
update public.ministry_memberships set role = 'member' where id = :'mm_a4';
delete from public.ministry_memberships where id = :'mm_a4';
reset role;
select tests.eq('líder sem permissão não altera nem remove (RLS filtra)', (select count(*) from public.ministry_memberships where id = :'mm_a4' and role = 'coordinator'), 1);

select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
delete from public.ministry_memberships where id = :'mm_a4';
reset role;
select tests.eq('admin removeu integrante', (select count(*) from public.ministry_memberships where id = :'mm_a4'), 0);

-- ---------- LGPD: pedidos de titulares e perfil ----------
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
insert into public.data_subject_requests (church_id, user_id, kind, details) values (:'church_a','00000000-0000-0000-0000-0000000000a4','access','quero meus dados');
select tests.denied('pedido em nome de outra pessoa', format($q$insert into public.data_subject_requests (church_id,user_id,kind) values (%L,'00000000-0000-0000-0000-0000000000a2','erasure')$q$, :'church_a'));
select tests.denied('pedido em outra igreja', format($q$insert into public.data_subject_requests (church_id,user_id,kind) values (%L,'00000000-0000-0000-0000-0000000000a4','access')$q$, :'church_b'));
update public.data_subject_requests set status = 'done';
select tests.denied('titular altera o prazo', $q$update public.data_subject_requests set due_at = now() + interval '5 years'$q$);
update public.profiles set full_name = 'Nome Novo A4', phone = '11999990000' where id = '00000000-0000-0000-0000-0000000000a4';
select tests.denied('perfil: altera id', $q$update public.profiles set id = '00000000-0000-0000-0000-0000000000a9' where id = '00000000-0000-0000-0000-0000000000a4'$q$);
reset role;
select tests.eq('membro não conclui o próprio pedido (RLS filtra)', (select count(*) from public.data_subject_requests where user_id = '00000000-0000-0000-0000-0000000000a4' and status = 'open'), 1);
select tests.eq('perfil próprio atualizado', (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000a4' and full_name = 'Nome Novo A4'), 1);

select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.eq('outro membro não vê o pedido', (select count(*) from public.data_subject_requests), 0);
update public.profiles set full_name = 'Invasor' where id = '00000000-0000-0000-0000-0000000000a4';
reset role;
select tests.eq('não altera perfil alheio', (select count(*) from public.profiles where full_name = 'Invasor'), 0);

select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.eq('admin vê pedidos da igreja', (select count(*) from public.data_subject_requests where church_id = :'church_a'), 1);
update public.data_subject_requests set status = 'in_progress', handled_by = '00000000-0000-0000-0000-0000000000a1';
select tests.denied('admin altera o conteúdo do pedido', $q$update public.data_subject_requests set details = 'reescrito'$q$);
update public.churches set name = 'Igreja A Renomeada', timezone = 'America/Manaus' where id = :'church_a';
reset role;
select tests.eq('admin concluiu atendimento', (select count(*) from public.data_subject_requests where status = 'in_progress'), 1);
select tests.eq('admin renomeou a igreja', (select count(*) from public.churches where id = :'church_a' and name = 'Igreja A Renomeada'), 1);

select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
update public.churches set name = 'Hack' where id = :'church_a';
reset role;
select tests.eq('membro não renomeia a igreja', (select count(*) from public.churches where name = 'Hack'), 0);

-- ---------- Presença (R-26) ----------
insert into public.events (church_id, title, kind, starts_at, ends_at) values (:'church_a','Culto de teste de presença','service', now() - interval '10 minutes', now() + interval '60 minutes') returning id as ev_att \gset
insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at) values (:'church_a', :'ev_att', 'Aberta', now() - interval '10 minutes', now() + interval '60 minutes') returning id as s_open \gset
insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at) values (:'church_a', :'ev_att', 'Futura', now() + interval '3 days', now() + interval '3 days 1 hour') returning id as s_future \gset
insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at) values (:'church_a', :'ev_att', 'Encerrada', now() - interval '3 days', now() - interval '3 days' + interval '1 hour') returning id as s_past \gset
select id as mem_a4 from public.church_memberships where church_id = :'church_a' and user_id = '00000000-0000-0000-0000-0000000000a4' \gset
select id as mem_a2 from public.church_memberships where church_id = :'church_a' and user_id = '00000000-0000-0000-0000-0000000000a2' \gset

select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
insert into public.attendance_records (church_id, session_id, membership_id) values (:'church_a', :'s_open', :'mem_a4');
select tests.denied('check-in duplicado', format($q$insert into public.attendance_records (church_id,session_id,membership_id) values (%L,%L,%L)$q$, :'church_a', :'s_open', :'mem_a4'));
select tests.denied('check-in antes da janela', format($q$insert into public.attendance_records (church_id,session_id,membership_id) values (%L,%L,%L)$q$, :'church_a', :'s_future', :'mem_a4'));
select tests.denied('check-in depois do fim', format($q$insert into public.attendance_records (church_id,session_id,membership_id) values (%L,%L,%L)$q$, :'church_a', :'s_past', :'mem_a4'));
select tests.denied('check-in em nome de outra pessoa', format($q$insert into public.attendance_records (church_id,session_id,membership_id) values (%L,%L,%L)$q$, :'church_a', :'s_open', :'mem_a2'));
select tests.denied('membro registra como líder', format($q$insert into public.attendance_records (church_id,session_id,membership_id,method) values (%L,%L,%L,'leader')$q$, :'church_a', :'s_open', :'mem_a2'));
select tests.eq('membro vê só a própria presença', (select count(*) from public.attendance_records), 1);
delete from public.attendance_records;
reset role;
select tests.eq('membro não apaga presença (RLS filtra)', (select count(*) from public.attendance_records where session_id = :'s_open'), 1);

select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
insert into public.attendance_records (church_id, session_id, membership_id, method) values (:'church_a', :'s_past', :'mem_a2', 'leader');
select tests.eq('líder de escala vê presenças', (select count(*) from public.attendance_records), 2);
delete from public.attendance_records where session_id = :'s_past';
reset role;
select tests.eq('líder removeu presença', (select count(*) from public.attendance_records where session_id = :'s_past'), 0);

select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.eq('outra igreja não vê presenças', (select count(*) from public.attendance_records), 0);
reset role;

-- ---------- Publicação agendada ----------
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
insert into public.announcements_and_devotionals (church_id, kind, title, body_md, status, publish_at, author_membership_id)
  values (:'church_a','announcement','Vence agora','corpo','scheduled', now() - interval '1 minute', (select id from public.church_memberships where church_id=:'church_a' and user_id='00000000-0000-0000-0000-0000000000a1')) returning id as c_due \gset
insert into public.announcements_and_devotionals (church_id, kind, title, body_md, status, publish_at, author_membership_id)
  values (:'church_a','announcement','Vence depois','corpo','scheduled', now() + interval '2 days', (select id from public.church_memberships where church_id=:'church_a' and user_id='00000000-0000-0000-0000-0000000000a1')) returning id as c_later \gset
select tests.denied('agendado sem data', format($q$insert into public.announcements_and_devotionals (church_id,kind,title,body_md,status) values (%L,'announcement','x','y','scheduled')$q$, :'church_a'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('membro não vê agendado', (select count(*) from public.announcements_and_devotionals where id in (:'c_due', :'c_later')), 0);
select tests.denied('executar pelo schema private', $q$select private.publish_due_content(null)$q$);
select tests.denied('publicar vencidos de outra igreja', format($q$select public.publish_due_content(%L)$q$, :'church_b'));
select public.publish_due_content(:'church_a') as publicados \gset
reset role;
select tests.eq('um conteúdo vencido foi publicado', :publicados, 1);
select tests.eq('o futuro continua agendado', (select count(*) from public.announcements_and_devotionals where id = :'c_later' and status = 'scheduled'), 1);
select tests.eq('publicado com data agendada', (select count(*) from public.announcements_and_devotionals where id = :'c_due' and status = 'published' and published_at = publish_at), 1);
select tests.eq('notificou membros (exceto autor)', (select count(*) from public.notifications where dedupe_key = 'content:' || :'c_due'), (select count(*) from public.church_memberships where church_id = :'church_a' and status = 'active' and user_id <> '00000000-0000-0000-0000-0000000000a1'));
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.eq('membro agora vê o publicado', (select count(*) from public.announcements_and_devotionals where id = :'c_due'), 1);
reset role;
select private.publish_due_content(null) as pelo_cron \gset
select tests.eq('cron sem nada vencido', :pelo_cron, 0);

-- ---------- Preferências de notificação (upsert do titular) ----------
select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
insert into public.notification_preferences (church_id, user_id, category, channel, enabled) values (:'church_a','00000000-0000-0000-0000-0000000000a4','devocional','in_app', false)
  on conflict (church_id, user_id, category, channel) do update set enabled = excluded.enabled;
insert into public.notification_preferences (church_id, user_id, category, channel, enabled) values (:'church_a','00000000-0000-0000-0000-0000000000a4','devocional','in_app', true)
  on conflict (church_id, user_id, category, channel) do update set enabled = excluded.enabled;
select tests.eq('upsert não duplica', (select count(*) from public.notification_preferences where category = 'devocional'), 1);
select tests.denied('preferência em nome de outra pessoa', format($q$insert into public.notification_preferences (church_id,user_id,category,channel,enabled) values (%L,'00000000-0000-0000-0000-0000000000a2','escala','in_app',false)$q$, :'church_a'));
select tests.denied('preferência em igreja alheia', format($q$insert into public.notification_preferences (church_id,user_id,category,channel,enabled) values (%L,'00000000-0000-0000-0000-0000000000a4','escala','in_app',false)$q$, :'church_b'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.eq('outra pessoa não vê preferências alheias', (select count(*) from public.notification_preferences where user_id = '00000000-0000-0000-0000-0000000000a4'), 0);
reset role;

-- ---------- Convites: autorização do painel de membros ----------
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
insert into public.church_invitations (church_id, email, role, token_hash, invited_by) values
 (:'church_a','novo@a.test','member', encode(extensions.digest('tok-novo','sha256'),'hex'), '00000000-0000-0000-0000-0000000000a1'),
 (:'church_a','velho@a.test','member', encode(extensions.digest('tok-velho','sha256'),'hex'), '00000000-0000-0000-0000-0000000000a1');
select tests.denied('admin forja invited_by', format($q$insert into public.church_invitations (church_id,email,role,token_hash,invited_by) values (%L,'f@a.test','member','h1','00000000-0000-0000-0000-0000000000b1')$q$, :'church_a'));
select tests.denied('admin convida para outra igreja', format($q$insert into public.church_invitations (church_id,email,role,token_hash,invited_by) values (%L,'f@a.test','member','h2','00000000-0000-0000-0000-0000000000a1')$q$, :'church_b'));
reset role;
update public.church_invitations set expires_at = now() - interval '1 day' where email = 'velho@a.test';

select tests.login('00000000-0000-0000-0000-0000000000a4','a4@a.test');
set role authenticated;
select tests.denied('membro cria convite', format($q$insert into public.church_invitations (church_id,email,role,token_hash,invited_by) values (%L,'m@a.test','admin','h3','00000000-0000-0000-0000-0000000000a4')$q$, :'church_a'));
select tests.eq('membro não enxerga convites', (select count(*) from public.church_invitations), 0);
reset role;

select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.eq('admin de outra igreja não enxerga convites', (select count(*) from public.church_invitations where church_id = :'church_a'), 0);
delete from public.church_invitations where church_id = :'church_a';
reset role;
select tests.eq('delete cross-tenant de convites não removeu nada', (select count(*) from public.church_invitations where email in ('novo@a.test','velho@a.test')), 2);

select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.eq('admin enxerga convites pendentes', (select count(*) from public.church_invitations where church_id = :'church_a' and accepted_at is null and email in ('novo@a.test','velho@a.test')), 2);
delete from public.church_invitations where email = 'novo@a.test' and accepted_at is null;
reset role;
select tests.eq('admin revogou convite', (select count(*) from public.church_invitations where email = 'novo@a.test'), 0);

insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c1','velho@a.test','{"full_name":"Pessoa Velha"}');
select tests.login('00000000-0000-0000-0000-0000000000c1','velho@a.test');
set role authenticated;
select tests.denied('convite expirado', $q$select public.accept_invitation('tok-velho')$q$);
select tests.denied('convite revogado', $q$select public.accept_invitation('tok-novo')$q$);
reset role;


-- ---------- Motor de IA: execuções, consentimento e rascunho ----------
insert into public.events (church_id, title, kind, status, starts_at, ends_at) values (:'church_a', 'Culto IA', 'service', 'scheduled', now() + interval '5 days', now() + interval '5 days 2 hours') returning id as ev_ai \gset
insert into public.event_sessions (church_id, event_id, name, starts_at, ends_at, ministry_id) values (:'church_a', :'ev_ai', 'Culto IA', now() + interval '5 days', now() + interval '5 days 2 hours', :'min_a') returning id as s_ai \gset
insert into public.ministry_memberships (church_id, ministry_id, membership_id, role, instruments)
  select :'church_a', :'min_a', id, 'member', '{bateria}' from public.church_memberships where church_id = :'church_a' and user_id = '00000000-0000-0000-0000-0000000000a4' returning id as mm_ai \gset

select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.denied('IA desativada por padrão bloqueia a execução', format($q$select public.ai_begin_schedule_run(%L,'schedule-v1','abc')$q$, :'s_ai'));
reset role;
update public.church_settings set ai_enabled = true, ai_data_sharing_consent_at = now() where church_id = :'church_a';

select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.denied('membro comum não inicia execução de IA', format($q$select public.ai_begin_schedule_run(%L,'schedule-v1','abc')$q$, :'s_ai'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.denied('líder de outra igreja não inicia execução', format($q$select public.ai_begin_schedule_run(%L,'schedule-v1','abc')$q$, :'s_ai'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select public.ai_begin_schedule_run(:'s_ai','schedule-v1','digest1') as run_ai \gset
select tests.eq('execução criada como pending', (select count(*) from public.ai_generation_runs where id = :'run_ai' and status = 'pending' and requested_by = '00000000-0000-0000-0000-0000000000a3'), 1);
select tests.denied('aceitar antes de validar', format($q$select public.ai_accept_schedule_run(%L)$q$, :'run_ai'));
select tests.denied('status final inválido', format($q$select public.ai_finish_run(%L,'accepted','m',1,1,'{}','{}')$q$, :'run_ai'));
select public.ai_finish_run(:'run_ai','validated','modelo-x',10,5,'{"assignments":[]}', jsonb_build_object('ok', true, 'accepted', jsonb_build_array(jsonb_build_object('ministry_membership_id', :'mm_ai', 'function', 'bateria'))));
select tests.denied('execução finalizada não finaliza de novo', format($q$select public.ai_finish_run(%L,'error','m',1,1,'{}','{}')$q$, :'run_ai'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a2','a2@a.test');
set role authenticated;
select tests.denied('membro comum não aceita sugestão', format($q$select public.ai_accept_schedule_run(%L)$q$, :'run_ai'));
select tests.denied('membro comum não finaliza execução alheia', format($q$select public.ai_finish_run(%L,'error','m',1,1,'{}','{}')$q$, :'run_ai'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.eq('aceite cria 1 rascunho', public.ai_accept_schedule_run(:'run_ai'), 1);
select tests.eq('rascunho nasce draft/source=ai com ai_run_id', (select count(*) from public.event_lineup where session_id = :'s_ai' and status = 'draft' and source = 'ai' and ai_run_id = :'run_ai'), 1);
select tests.eq('execução marcada accepted', (select count(*) from public.ai_generation_runs where id = :'run_ai' and status = 'accepted' and accepted_at is not null), 1);
select tests.denied('aceite repetido', format($q$select public.ai_accept_schedule_run(%L)$q$, :'run_ai'));
select public.ai_begin_schedule_run(:'s_ai','schedule-v1','digest2') as run_ai2 \gset
select public.ai_finish_run(:'run_ai2','validation_failed','modelo-x',10,5,'{}','{"ok":false,"accepted":[]}');
select tests.denied('sugestão reprovada na validação não vira rascunho', format($q$select public.ai_accept_schedule_run(%L)$q$, :'run_ai2'));
select public.ai_discard_run(:'run_ai2');
select tests.eq('execução descartada', (select count(*) from public.ai_generation_runs where id = :'run_ai2' and status = 'discarded'), 1);
select tests.denied('descartar execução já aceita', format($q$select public.ai_discard_run(%L)$q$, :'run_ai'));
select tests.denied('escrita direta em ai_generation_runs negada', format($q$update public.ai_generation_runs set status = 'accepted' where id = %L$q$, :'run_ai2'));
reset role;
select tests.eq('aceite não publicou nada', (select count(*) from public.event_lineup where ai_run_id = :'run_ai' and status <> 'draft'), 0);


-- ---------- Ativação da IA: só admin, via função, com consentimento registrado ----------
update public.church_settings set ai_enabled = false, ai_data_sharing_consent_at = null where church_id = :'church_a';
select tests.login('00000000-0000-0000-0000-0000000000a3','a3@a.test');
set role authenticated;
select tests.denied('líder não ativa IA', format($q$select public.set_church_ai(%L, true, 'ia-v1')$q$, :'church_a'));
select tests.denied('líder não liga IA por update direto', format($q$update public.church_settings set ai_enabled = true where church_id = %L$q$, :'church_a'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.denied('admin não liga IA por update direto (sem consentimento)', format($q$update public.church_settings set ai_enabled = true, ai_data_sharing_consent_at = now() where church_id = %L$q$, :'church_a'));
select tests.denied('termo sem versão', format($q$select public.set_church_ai(%L, true, '')$q$, :'church_a'));
select public.set_church_ai(:'church_a', true, 'ia-v1');
select tests.eq('IA ligada com consentimento datado', (select count(*) from public.church_settings where church_id = :'church_a' and ai_enabled and ai_data_sharing_consent_at is not null), 1);
select tests.eq('consentimento registrado', (select count(*) from public.consent_records where church_id = :'church_a' and purpose = 'ai_data_sharing' and granted and version = 'ia-v1' and user_id = '00000000-0000-0000-0000-0000000000a1'), 1);
with u as (update public.church_settings set rotation_policy = rotation_policy where church_id = :'church_a' returning 1)
select tests.eq('admin ainda altera a política de rotação', (select count(*) from u), 1);
select public.set_church_ai(:'church_a', false, 'ia-v1');
select tests.eq('IA desligada revoga o consentimento', (select count(*) from public.church_settings where church_id = :'church_a' and not ai_enabled and ai_data_sharing_consent_at is null), 1);
select tests.eq('revogação registrada', (select count(*) from public.consent_records where church_id = :'church_a' and purpose = 'ai_data_sharing' and not granted), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1','b1@b.test');
set role authenticated;
select tests.denied('admin de outra igreja não ativa IA', format($q$select public.set_church_ai(%L, true, 'ia-v1')$q$, :'church_a'));
reset role;

-- ---------- Auditoria imutável; anon sem acesso ----------
select tests.login('00000000-0000-0000-0000-0000000000a1','a1@a.test');
set role authenticated;
select tests.denied('auditoria: update', $q$update public.audit_logs set action='x'$q$);
select tests.denied('auditoria: delete', $q$delete from public.audit_logs$q$);
reset role;
select tests.denied('auditoria: delete como superusuário', $q$delete from public.audit_logs$q$);
set role anon;
select tests.denied('anon lê ministérios', $q$select * from public.ministries$q$);
select tests.denied('anon lê perfis', $q$select * from public.profiles$q$);
select tests.denied('anon executa create_church', $q$select public.create_church('a','abc')$q$);
reset role;

-- ---------- Varredura: todas as tabelas de public têm RLS ----------
select tests.eq('todas as tabelas com RLS', (select count(*) from pg_tables t join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace where t.schemaname='public' and not c.relrowsecurity), 0);
select tests.eq('funções SECURITY DEFINER com search_path fixo',
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')), 0);
select tests.eq('toda tabela com church_id (exceto churches) tem RLS e ao menos uma política ou é infra',
  (select count(*) from information_schema.columns c
    where c.table_schema='public' and c.column_name='church_id'
      and not exists (select 1 from pg_policies pp where pp.schemaname='public' and pp.tablename=c.table_name)), 0);
select 'OK: testes de RLS e regras concluídos' as resultado;
