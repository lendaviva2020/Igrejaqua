-- IGREJAQUA — testes SQL do link de entrada da igreja e da aprovação de pedidos
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
 ('00000000-0000-0000-0000-0000000000a7','pastor@jl.test','{"full_name":"Pastor JL"}'),
 ('00000000-0000-0000-0000-0000000000b7','fiel@jl.test','{"full_name":"Fiel JL"}'),
 ('00000000-0000-0000-0000-0000000000c7','outro@jl.test','{"full_name":"Outro JL"}');

select tests.login('00000000-0000-0000-0000-0000000000a7','pastor@jl.test');
set role authenticated; select public.create_church('Igreja Link','igreja-link') as church_l \gset
reset role;

-- ===== gestão do link =====
select tests.login('00000000-0000-0000-0000-0000000000b7','fiel@jl.test');
set role authenticated;
select tests.denied('não admin gera link', format($q$select public.rotate_church_join_link(%L, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')$q$, :'church_l'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a7','pastor@jl.test');
set role authenticated;
select tests.denied('token fora do formato', format($q$select public.rotate_church_join_link(%L, 'curto')$q$, :'church_l'));
select public.rotate_church_join_link(:'church_l', 'link1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
select public.rotate_church_join_link(:'church_l', 'link2_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
select tests.eq('admin vê os links', (select count(*) from public.church_join_links where church_id = :'church_l'), 2);
select tests.eq('só um link ativo', (select count(*) from public.church_join_links where church_id = :'church_l' and revoked_at is null), 1);
reset role;

-- ===== pedido de entrada =====
select tests.login('00000000-0000-0000-0000-0000000000b7','fiel@jl.test');
set role authenticated;
select tests.eq('não admin não lê links', (select count(*) from public.church_join_links), 0);
select tests.denied('link antigo (trocado) não funciona', $q$select * from public.request_church_join('link1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')$q$);
select tests.eq('pedido fica pendente', (select count(*) from public.request_church_join('link2_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB') r where r.status = 'pending'), 1);
select tests.eq('repetir o pedido não duplica', (select count(*) from public.request_church_join('link2_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB') r where r.status = 'pending'), 1);
select tests.eq('pendente não acessa a igreja', (select count(*) from public.churches where id = :'church_l'), 0);
select tests.eq('pendente vê o próprio pedido', (select count(*) from public.church_memberships where church_id = :'church_l' and status = 'pending'), 1);
select tests.eq('lista de pedidos próprios traz a igreja', (select count(*) from public.my_pending_join_requests() p where p.church_id = :'church_l' and p.church_name = 'Igreja Link'), 1);
-- A RLS não gera erro num UPDATE bloqueado: ela filtra as linhas (0 alteradas). Por isso a prova é o estado
-- depois da tentativa — o vínculo continua pendente (verificado logo abaixo, já fora do papel authenticated).
update public.church_memberships set status = 'active' where church_id = :'church_l' and user_id = auth.uid();
select tests.eq('pendente não se aprova (nenhuma linha visível para atualizar como ativa)', (select count(*) from public.church_memberships where church_id = :'church_l' and user_id = auth.uid() and status = 'active'), 0);
reset role;
select tests.eq('vínculo pendente como membro comum', (select count(*) from public.church_memberships where church_id = :'church_l' and user_id = '00000000-0000-0000-0000-0000000000b7' and status = 'pending' and role = 'member'), 1);
select tests.eq('admin foi notificado', (select count(*) from public.notifications where church_id = :'church_l' and user_id = '00000000-0000-0000-0000-0000000000a7' and category = 'membros'), 1);

-- ===== aprovação / recusa pelo admin =====
select tests.login('00000000-0000-0000-0000-0000000000a7','pastor@jl.test');
set role authenticated;
select tests.eq('admin vê o pedido no diretório', (select count(*) from public.church_directory(:'church_l') d where d.status = 'pending'), 1);
update public.church_memberships set status = 'left' where church_id = :'church_l' and user_id = '00000000-0000-0000-0000-0000000000b7' and status = 'pending';
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b7','fiel@jl.test');
set role authenticated;
select tests.eq('recusado pode pedir de novo', (select count(*) from public.request_church_join('link2_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB') r where r.status = 'pending'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000a7','pastor@jl.test');
set role authenticated;
update public.church_memberships set status = 'active' where church_id = :'church_l' and user_id = '00000000-0000-0000-0000-0000000000b7' and status = 'pending';
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b7','fiel@jl.test');
set role authenticated;
select tests.eq('aprovado acessa a igreja', (select count(*) from public.churches where id = :'church_l'), 1);
select tests.eq('membro ativo pelo link continua ativo', (select count(*) from public.request_church_join('link2_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB') r where r.status = 'active'), 1);
reset role;

-- ===== exceção da guarda não serve fora do pedido =====
select tests.login('00000000-0000-0000-0000-0000000000a7','pastor@jl.test');
set role authenticated;
update public.church_memberships set status = 'suspended' where church_id = :'church_l' and user_id = '00000000-0000-0000-0000-0000000000b7';
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b7','fiel@jl.test');
set role authenticated;
select tests.denied('suspenso não volta pelo link', $q$select * from public.request_church_join('link2_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')$q$);
-- Mesmo com a flag interna ligada à mão, a RLS filtra o UPDATE (0 linhas): o vínculo segue suspenso.
select set_config('iq.self_join_request', 'on', false);
update public.church_memberships set status = 'active' where church_id = :'church_l' and user_id = auth.uid();
select set_config('iq.self_join_request', '', false);
reset role;
select tests.eq('flag manual não libera auto-aprovação', (select count(*) from public.church_memberships where church_id = :'church_l' and user_id = '00000000-0000-0000-0000-0000000000b7' and status = 'suspended'), 1);

-- ===== link desativado =====
select tests.login('00000000-0000-0000-0000-0000000000a7','pastor@jl.test');
set role authenticated;
select public.disable_church_join_link(:'church_l');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000c7','outro@jl.test');
set role authenticated;
select tests.denied('link desativado', $q$select * from public.request_church_join('link2_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')$q$);
select tests.denied('anônimo/sem login não usa funções de admin', format($q$select public.disable_church_join_link(%L)$q$, :'church_l'));
reset role;
select tests.eq('outro não ganhou vínculo', (select count(*) from public.church_memberships where user_id = '00000000-0000-0000-0000-0000000000c7'), 0);
