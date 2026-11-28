-- IGREJAQUA — testes SQL: chave Pix por igreja, confirmação manual e conta Mercado Pago por igreja
\set ON_ERROR_STOP on
create schema if not exists tests;
grant usage on schema tests to authenticated, anon, service_role;
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
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000aa','pastor@pay.test','{"full_name":"Pastor Pay"}'),
 ('00000000-0000-0000-0000-0000000000ab','membro@pay.test','{"full_name":"Membro Pay"}'),
 ('00000000-0000-0000-0000-0000000000ac','outro@pay.test','{"full_name":"Outro Pay"}');

-- Igreja P (pastor admin + membro) e igreja Q (outro admin)
select tests.login('00000000-0000-0000-0000-0000000000aa','pastor@pay.test');
set role authenticated;
select public.create_church('Igreja Pay','igreja-pay') as church_p \gset
reset role;
insert into public.church_memberships (church_id, user_id, role, status) values (:'church_p', '00000000-0000-0000-0000-0000000000ab', 'member', 'active');
select tests.login('00000000-0000-0000-0000-0000000000ac','outro@pay.test');
set role authenticated;
select public.create_church('Igreja Q','igreja-q') as church_q \gset
reset role;

-- ===== chave Pix =====
select tests.login('00000000-0000-0000-0000-0000000000aa','pastor@pay.test');
set role authenticated;
insert into public.church_pix_keys (church_id, key_type, pix_key, recipient_name, recipient_city) values (:'church_p', 'cnpj', '11222333000181', 'IGREJA PAY', 'SAO PAULO');
select tests.denied('CNPJ com letras', format($q$update public.church_pix_keys set pix_key = '11.222.333/0001-81' where church_id = %L$q$, :'church_p'));
select tests.denied('celular sem +55', format($q$update public.church_pix_keys set key_type = 'phone', pix_key = '11999999999' where church_id = %L$q$, :'church_p'));
select tests.denied('nome longo demais', format($q$update public.church_pix_keys set recipient_name = repeat('A', 26) where church_id = %L$q$, :'church_p'));
update public.church_pix_keys set key_type = 'email', pix_key = 'tesouraria@igreja.org' where church_id = :'church_p';
reset role;
select tests.eq('admin avisado das 2 mudanças', (select count(*) from public.notifications where church_id = :'church_p' and user_id = '00000000-0000-0000-0000-0000000000aa' and title = 'Chave Pix da igreja alterada'), 2);
select tests.eq('mudança auditada', (select count(*) from public.audit_logs where church_id = :'church_p' and entity_table = 'church_pix_keys'), 2);

select tests.login('00000000-0000-0000-0000-0000000000ab','membro@pay.test');
set role authenticated;
select tests.eq('membro lê a chave da própria igreja', (select count(*) from public.church_pix_keys where church_id = :'church_p'), 1);
update public.church_pix_keys set pix_key = 'golpe@golpe.com' where church_id = :'church_p';
delete from public.church_pix_keys where church_id = :'church_p';
select tests.denied('membro não cria chave', format($q$insert into public.church_pix_keys (church_id, key_type, pix_key, recipient_name, recipient_city) values (%L,'email','x@y.com','X','Y')$q$, :'church_q'));
reset role;
select tests.eq('membro não altera nem apaga a chave', (select count(*) from public.church_pix_keys where church_id = :'church_p' and pix_key = 'tesouraria@igreja.org'), 1);

select tests.login('00000000-0000-0000-0000-0000000000ac','outro@pay.test');
set role authenticated;
select tests.eq('outra igreja não lê a chave', (select count(*) from public.church_pix_keys where church_id = :'church_p'), 0);
reset role;

-- ===== confirmação manual de contribuição pela chave =====
select tests.login('00000000-0000-0000-0000-0000000000ab','membro@pay.test');
set role authenticated;
insert into public.pix_charges (church_id, membership_id, purpose, amount_cents)
  values (:'church_p', (select id from public.church_memberships where church_id = :'church_p' and user_id = '00000000-0000-0000-0000-0000000000ab'), 'oferta', 5000)
  returning id as charge_k \gset
insert into public.pix_charges (church_id, membership_id, purpose, amount_cents)
  values (:'church_p', (select id from public.church_memberships where church_id = :'church_p' and user_id = '00000000-0000-0000-0000-0000000000ab'), 'dizimo', 7000)
  returning id as charge_mp \gset
reset role;
update public.pix_charges set provider = 'pix_key', pix_txid = 'IQ123ABC' where id = :'charge_k';
select tests.denied('provider desconhecido', format($q$update public.pix_charges set provider = 'banco_x' where id = %L$q$, :'charge_k'));
select tests.denied('txid inválido', format($q$update public.pix_charges set pix_txid = 'com espaço' where id = %L$q$, :'charge_k'));

select tests.login('00000000-0000-0000-0000-0000000000ab','membro@pay.test');
set role authenticated;
select tests.denied('membro não confirma a própria contribuição', format($q$select public.review_pix_key_charge(%L, %L, true)$q$, :'church_p', :'charge_k'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000ac','outro@pay.test');
set role authenticated;
select tests.denied('admin de outra igreja não confirma', format($q$select public.review_pix_key_charge(%L, %L, true)$q$, :'church_p', :'charge_k'));
reset role;

select tests.login('00000000-0000-0000-0000-0000000000aa','pastor@pay.test');
set role authenticated;
select tests.denied('cobrança do Mercado Pago não é confirmada à mão', format($q$select public.review_pix_key_charge(%L, %L, true)$q$, :'church_p', :'charge_mp'));
select public.review_pix_key_charge(:'church_p', :'charge_k', true);
select tests.denied('não confirma duas vezes', format($q$select public.review_pix_key_charge(%L, %L, false)$q$, :'church_p', :'charge_k'));
reset role;
select tests.eq('confirmada com quem e quando', (select count(*) from public.pix_charges where id = :'charge_k' and status = 'approved' and paid_at is not null and confirmed_by = '00000000-0000-0000-0000-0000000000aa'), 1);
select tests.eq('administração avisada da confirmação', (select count(*) from public.notifications where church_id = :'church_p' and title = 'Contribuição Pix confirmada'), 1);

-- ===== conta Mercado Pago (tokens só no servidor) =====
insert into public.church_mercadopago_accounts (church_id, mp_user_id, access_token_enc, refresh_token_enc, token_expires_at, live_mode, connected_by)
  values (:'church_p', '123456789', 'v1.cifrado', 'v1.cifrado', now() + interval '180 days', true, '00000000-0000-0000-0000-0000000000aa');
select tests.eq('admin avisado da conexão', (select count(*) from public.notifications where church_id = :'church_p' and title = 'Mercado Pago conectado'), 1);

select tests.login('00000000-0000-0000-0000-0000000000aa','pastor@pay.test');
set role authenticated;
select tests.denied('nem a administração lê tokens pela API', format($q$select access_token_enc from public.church_mercadopago_accounts where church_id = %L$q$, :'church_p'));
select tests.eq('status da conexão sem tokens', (select count(*) from public.church_mercadopago_status(:'church_p') s where s.connected and s.mp_user_id = '123456789'), 1);
reset role;

select tests.login('00000000-0000-0000-0000-0000000000ac','outro@pay.test');
set role authenticated;
select tests.eq('outra igreja não vê a conexão', (select count(*) from public.church_mercadopago_status(:'church_p')), 0);
reset role;

\echo 'OK 150_payment_methods'
