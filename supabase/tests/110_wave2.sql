-- IGREJAQUA — testes SQL da Onda 2 (famílias, visitantes, células, livro-caixa)
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
 ('00000000-0000-0000-0000-0000000000e1','c1@w2.test','{"full_name":"Admin W2"}'),
 ('00000000-0000-0000-0000-0000000000e2','c2@w2.test','{"full_name":"Lider W2"}'),
 ('00000000-0000-0000-0000-0000000000e3','c3@w2.test','{"full_name":"Membro W2"}'),
 ('00000000-0000-0000-0000-0000000000e4','c4@w2.test','{"full_name":"Membro W2 outro"}'),
 ('00000000-0000-0000-0000-0000000000f1','d1@w2.test','{"full_name":"Admin outra igreja"}');

select tests.login('00000000-0000-0000-0000-0000000000e1','c1@w2.test');
set role authenticated; select public.create_church('Igreja W2','igreja-w2') as church_w \gset
reset role;
select tests.login('00000000-0000-0000-0000-0000000000f1','d1@w2.test');
set role authenticated; select public.create_church('Igreja W2 B','igreja-w2-b') as church_x \gset
reset role;

-- vincula c2 (líder com manage_members), c3 e c4 (membros) à igreja W2 pelo superusuário (fixture)
insert into public.church_memberships (church_id, user_id, role) values
 (:'church_w','00000000-0000-0000-0000-0000000000e2','leader'),
 (:'church_w','00000000-0000-0000-0000-0000000000e3','member'),
 (:'church_w','00000000-0000-0000-0000-0000000000e4','member');
select m.id as m_admin from public.church_memberships m where m.church_id = :'church_w' and m.user_id = '00000000-0000-0000-0000-0000000000e1' \gset
select m.id as m_lider from public.church_memberships m where m.church_id = :'church_w' and m.user_id = '00000000-0000-0000-0000-0000000000e2' \gset
select m.id as m_c3 from public.church_memberships m where m.church_id = :'church_w' and m.user_id = '00000000-0000-0000-0000-0000000000e3' \gset
select m.id as m_c4 from public.church_memberships m where m.church_id = :'church_w' and m.user_id = '00000000-0000-0000-0000-0000000000e4' \gset

-- e2 recebe `manage_members` num ministério (o papel "leader" sozinho não concede poder, RBAC §4); feito como admin
select tests.login('00000000-0000-0000-0000-0000000000e1','c1@w2.test');
set role authenticated;
insert into public.ministries (church_id, name, slug) values (:'church_w','Acolhimento','acolhimento') returning id as min_w \gset
insert into public.ministry_memberships (church_id, ministry_id, membership_id, role)
  select :'church_w', :'min_w', id, 'coordinator' from public.church_memberships where church_id = :'church_w' and user_id = '00000000-0000-0000-0000-0000000000e2' returning id as mm_w \gset
insert into public.ministry_permissions (church_id, ministry_id, ministry_membership_id, permission) values (:'church_w', :'min_w', :'mm_w', 'manage_members');
reset role;

-- ===== Famílias =====
select tests.login('00000000-0000-0000-0000-0000000000e1','c1@w2.test');
set role authenticated;
insert into public.families (church_id, name) values (:'church_w','Família Silva') returning id as fam \gset
insert into public.family_members (church_id, family_id, membership_id, relation) values (:'church_w', :'fam', :'m_c3', 'responsavel');
insert into public.families (church_id, name) values (:'church_w','Família sem responsável') returning id as fam2 \gset
select tests.denied('menor em família sem responsável', format($q$insert into public.family_members (church_id, family_id, full_name, relation, birth_date)
  values (%L, %L, 'Filho', 'filho', current_date - interval '5 years')$q$, :'church_w', :'fam2'));
insert into public.family_members (church_id, family_id, full_name, relation, birth_date) values (:'church_w', :'fam', 'Pedro Silva', 'filho', (current_date - interval '5 years')::date);
select tests.denied('menor não pode ser responsável', format($q$insert into public.family_members (church_id, family_id, full_name, relation, birth_date)
  values (%L, %L, 'Menor', 'responsavel', current_date - interval '10 years')$q$, :'church_w', :'fam'));
select tests.denied('pessoa com conta E nome', format($q$insert into public.family_members (church_id, family_id, membership_id, full_name, relation) values (%L, %L, %L, 'X', 'outro')$q$, :'church_w', :'fam', :'m_c4'));
select tests.denied('mesmo membro em duas famílias', format($q$with f as (insert into public.families (church_id, name) values (%L, 'Outra') returning id)
  insert into public.family_members (church_id, family_id, membership_id, relation) select %L, id, %L, 'responsavel' from f$q$, :'church_w', :'church_w', :'m_c3'));
select tests.denied('remover último responsável com menor', format($q$delete from public.family_members where family_id = %L and relation = 'responsavel'$q$, :'fam'));
reset role;
-- líder lê; membro da família lê a própria; outro membro não
select tests.login('00000000-0000-0000-0000-0000000000e2','c2@w2.test');
set role authenticated;
select tests.eq('líder lê famílias', (select count(*) from public.families), 2);
select tests.denied('líder não cria família', format($q$insert into public.families (church_id, name) values (%L,'X')$q$, :'church_w'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e3','c3@w2.test');
set role authenticated;
select tests.eq('responsável lê a própria família', (select count(*) from public.families), 1);
select tests.eq('responsável lê os membros da família', (select count(*) from public.family_members), 2);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e4','c4@w2.test');
set role authenticated;
select tests.eq('outro membro não vê famílias', (select count(*) from public.families), 0);
select tests.eq('outro membro não vê dependentes', (select count(*) from public.family_members), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000f1','d1@w2.test');
set role authenticated;
select tests.eq('admin de outra igreja não vê famílias', (select count(*) from public.families), 0);
select tests.denied('admin de outra igreja não grava no tenant alheio', format($q$insert into public.families (church_id, name) values (%L,'Invasão')$q$, :'church_w'));
reset role;

-- papel 'leader' sem permissão de ministério não enxerga nada (c5)
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000e5','e5@w2.test','{"full_name":"Lider sem permissao"}');
insert into public.church_memberships (church_id, user_id, role) values (:'church_w','00000000-0000-0000-0000-0000000000e5','leader');
select tests.login('00000000-0000-0000-0000-0000000000e5','e5@w2.test');
set role authenticated;
select tests.eq('leader sem permissão não vê famílias', (select count(*) from public.families), 0);
select tests.eq('leader sem permissão não vê visitantes', (select count(*) from public.visitors), 0);
reset role;

-- ===== Visitantes =====
select tests.login('00000000-0000-0000-0000-0000000000e2','c2@w2.test');
set role authenticated;
select tests.denied('telefone sem consentimento', format($q$insert into public.visitors (church_id, full_name, phone) values (%L,'Visitante','11999990000')$q$, :'church_w'));
insert into public.visitors (church_id, full_name, phone, contact_consent_at, source) values (:'church_w','Visitante Ana','11999990000', now(), 'convite') returning id as vis \gset
insert into public.visitors (church_id, full_name) values (:'church_w','Visitante sem contato');
insert into public.visit_followups (church_id, visitor_id, kind, note, by_membership_id) values (:'church_w', :'vis', 'ligacao', 'Primeiro contato', :'m_lider');
select tests.denied('followup em nome de outro', format($q$insert into public.visit_followups (church_id, visitor_id, kind, note, by_membership_id) values (%L,%L,'ligacao','x',%L)$q$, :'church_w', :'vis', :'m_admin'));
select tests.eq('líder lê visitantes', (select count(*) from public.visitors), 2);
delete from public.visitors where id = :'vis';
select tests.eq('líder não apaga visitante (RLS filtra)', (select count(*) from public.visitors where id = :'vis'), 1);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e3','c3@w2.test');
set role authenticated;
select tests.eq('membro comum não vê visitantes', (select count(*) from public.visitors), 0);
select tests.eq('membro comum não vê acompanhamentos', (select count(*) from public.visit_followups), 0);
select tests.denied('membro comum não cria visitante', format($q$insert into public.visitors (church_id, full_name) values (%L,'X')$q$, :'church_w'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e1','c1@w2.test');
set role authenticated;
delete from public.visitors where id = :'vis';
select tests.eq('admin apaga visitante (apagamento LGPD) e leva os acompanhamentos', (select count(*) from public.visit_followups), 0);
reset role;

-- ===== Células =====
select tests.login('00000000-0000-0000-0000-0000000000e1','c1@w2.test');
set role authenticated;
insert into public.cell_groups (church_id, name, leader_membership_id, weekday, location) values (:'church_w','Célula Centro', :'m_lider', 3, 'Casa do Silva') returning id as cel \gset
select tests.denied('nome de célula duplicado (case-insensitive)', format($q$insert into public.cell_groups (church_id, name, leader_membership_id) values (%L,'célula centro',%L)$q$, :'church_w', :'m_lider'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e2','c2@w2.test');
set role authenticated;
insert into public.cell_members (church_id, cell_id, membership_id) values (:'church_w', :'cel', :'m_c3');
insert into public.cell_meetings (church_id, cell_id, held_on, topic) values (:'church_w', :'cel', current_date, 'Estudo') returning id as reu \gset
insert into public.cell_meeting_attendance (church_id, meeting_id, membership_id) values (:'church_w', :'reu', :'m_c3');
select tests.denied('presença de quem não é da célula', format($q$insert into public.cell_meeting_attendance (church_id, meeting_id, membership_id) values (%L,%L,%L)$q$, :'church_w', :'reu', :'m_c4'));
select tests.denied('reunião no futuro', format($q$insert into public.cell_meetings (church_id, cell_id, held_on) values (%L,%L,current_date + 1)$q$, :'church_w', :'cel'));
select tests.denied('líder não cria célula', format($q$insert into public.cell_groups (church_id, name, leader_membership_id) values (%L,'Outra',%L)$q$, :'church_w', :'m_lider'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e3','c3@w2.test');
set role authenticated;
select tests.eq('membro da célula lê as reuniões', (select count(*) from public.cell_meetings), 1);
select tests.eq('membro da célula lê a presença', (select count(*) from public.cell_meeting_attendance), 1);
select tests.denied('membro não registra reunião', format($q$insert into public.cell_meetings (church_id, cell_id, held_on) values (%L,%L,current_date - 1)$q$, :'church_w', :'cel'));
delete from public.cell_members where membership_id = :'m_c3';
select tests.eq('membro pode sair da célula', (select count(*) from public.cell_members), 0);
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e4','c4@w2.test');
set role authenticated;
select tests.eq('não participante não vê reuniões', (select count(*) from public.cell_meetings), 0);
select tests.eq('mas vê a lista de células', (select count(*) from public.cell_groups), 1);
reset role;

-- ===== Livro-caixa =====
select tests.login('00000000-0000-0000-0000-0000000000e1','c1@w2.test');
set role authenticated;
insert into public.finance_categories (church_id, name, kind) values (:'church_w','Ofertas','entrada') returning id as cat_in \gset
insert into public.finance_categories (church_id, name, kind) values (:'church_w','Energia','saida') returning id as cat_out \gset
select tests.denied('categoria duplicada', format($q$insert into public.finance_categories (church_id, name, kind) values (%L,'ofertas','entrada')$q$, :'church_w'));
insert into public.finance_entries (church_id, kind, category_id, occurred_on, amount_cents, description, created_by_membership_id) values
  (:'church_w','entrada', :'cat_in', current_date, 150000, 'Oferta do culto', :'m_admin') returning id as lanc \gset
insert into public.finance_entries (church_id, kind, category_id, occurred_on, amount_cents, description, created_by_membership_id) values
  (:'church_w','saida', :'cat_out', current_date, 40000, 'Conta de luz', :'m_admin');
select tests.denied('categoria de outro tipo', format($q$insert into public.finance_entries (church_id, kind, category_id, occurred_on, amount_cents, description, created_by_membership_id) values (%L,'saida',%L,current_date,100,'x',%L)$q$, :'church_w', :'cat_in', :'m_admin'));
select tests.denied('valor zero', format($q$insert into public.finance_entries (church_id, kind, category_id, occurred_on, amount_cents, description, created_by_membership_id) values (%L,'entrada',%L,current_date,0,'x',%L)$q$, :'church_w', :'cat_in', :'m_admin'));
select tests.denied('data futura', format($q$insert into public.finance_entries (church_id, kind, category_id, occurred_on, amount_cents, description, created_by_membership_id) values (%L,'entrada',%L,current_date+1,100,'x',%L)$q$, :'church_w', :'cat_in', :'m_admin'));
select tests.denied('autor falsificado', format($q$insert into public.finance_entries (church_id, kind, category_id, occurred_on, amount_cents, description, created_by_membership_id) values (%L,'entrada',%L,current_date,100,'x',%L)$q$, :'church_w', :'cat_in', :'m_lider'));
select tests.denied('não edita o valor', format($q$update public.finance_entries set amount_cents = 1 where id = %L$q$, :'lanc'));
select tests.denied('não apaga lançamento (sem privilégio)', format($q$delete from public.finance_entries where id = %L$q$, :'lanc'));
select tests.denied('estorno sem motivo', format($q$update public.finance_entries set voided_at = now(), voided_by_membership_id = %L where id = %L$q$, :'m_admin', :'lanc'));
select year, month from (select extract(year from current_date)::int as year, extract(month from current_date)::int as month) t \gset
select tests.eq('entradas do mês', (select total_cents from public.finance_month_summary(:'church_w', :year, :month) where kind = 'entrada' and total_cents > 0), 150000);
update public.finance_entries set voided_at = now(), voided_reason = 'Lançado em duplicidade', voided_by_membership_id = :'m_admin' where id = :'lanc';
select tests.eq('estorno sai do resumo', (select coalesce(sum(total_cents),0)::bigint from public.finance_month_summary(:'church_w', :year, :month) where kind = 'entrada'), 0);
select tests.denied('estornado é imutável', format($q$update public.finance_entries set voided_reason = 'outro motivo' where id = %L$q$, :'lanc'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e2','c2@w2.test');
set role authenticated;
select tests.eq('líder não vê lançamentos', (select count(*) from public.finance_entries), 0);
select tests.eq('líder não vê categorias', (select count(*) from public.finance_categories), 0);
select tests.denied('líder não lança', format($q$insert into public.finance_entries (church_id, kind, category_id, occurred_on, amount_cents, description, created_by_membership_id) values (%L,'entrada',%L,current_date,100,'x',%L)$q$, :'church_w', :'cat_in', :'m_lider'));
reset role;
select tests.login('00000000-0000-0000-0000-0000000000f1','d1@w2.test');
set role authenticated;
select tests.eq('admin de outra igreja não vê o caixa', (select count(*) from public.finance_entries), 0);
select tests.eq('resumo de outra igreja vem vazio', (select count(*) from public.finance_month_summary(:'church_w', :year, :month)), 0);
reset role;
select tests.eq('auditoria registrou o caixa sem valores', (select count(*) from public.audit_logs where entity_table = 'finance_entries' and diff::text !~ '[0-9]{5}'), (select count(*) from public.audit_logs where entity_table = 'finance_entries'));
select 'OK: testes da Onda 2 concluídos' as resultado;

-- ===== Retenção de contato de visitantes =====
insert into public.visitors (church_id, full_name, phone, contact_consent_at, created_at, updated_at) values
  (:'church_w','Visitante Antigo','11999990001', now() - interval '500 days', now() - interval '500 days', now() - interval '500 days'),
  (:'church_w','Visitante Recente','11999990002', now() - interval '10 days', now() - interval '10 days', now() - interval '10 days');
select private.run_retention();
select tests.eq('retenção: contato de visitante antigo apagado, nome preservado', (select count(*) from public.visitors where full_name = 'Visitante Antigo' and phone is null and contact_consent_at is null), 1);
select tests.eq('retenção: contato de visitante recente preservado', (select count(*) from public.visitors where full_name = 'Visitante Recente' and phone is not null), 1);

-- ===== Aviso à administração: contribuição Pix confirmada =====
insert into public.pix_charges (church_id, membership_id, purpose, amount_cents, status)
  select :'church_w', id, 'dizimo', 12345, 'pending' from public.church_memberships where church_id = :'church_w' and user_id = '00000000-0000-0000-0000-0000000000e3' returning id as pix_w \gset
select tests.eq('pix pendente não notifica', (select count(*) from public.notifications where dedupe_key = 'pix:' || :'pix_w'), 0);
update public.pix_charges set status = 'approved', paid_at = now() where id = :'pix_w';
select tests.eq('pix aprovado notifica só administradores', (select count(*) from public.notifications n join public.church_memberships m on m.church_id = n.church_id and m.user_id = n.user_id where n.dedupe_key = 'pix:' || :'pix_w' and m.role <> 'admin'), 0);
select tests.eq('pix aprovado notifica o administrador', (select count(*) from public.notifications where dedupe_key = 'pix:' || :'pix_w' and user_id = '00000000-0000-0000-0000-0000000000e1' and body = 'Pix de R$ 123,45 confirmado (dízimo).'), 1);
select tests.eq('aviso não identifica o contribuinte', (select count(*) from public.notifications where dedupe_key = 'pix:' || :'pix_w' and (body ilike '%e3%' or title ilike '%e3%')), 0);
update public.pix_charges set updated_at = now() where id = :'pix_w';
select tests.eq('reprocessar não duplica o aviso', (select count(*) from public.notifications where dedupe_key = 'pix:' || :'pix_w' and user_id = '00000000-0000-0000-0000-0000000000e1'), 1);
