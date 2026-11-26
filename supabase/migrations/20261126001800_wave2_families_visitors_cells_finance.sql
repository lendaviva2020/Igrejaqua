-- IGREJAQUA — Onda 2: famílias, visitantes, células e livro-caixa (sem atribuição por pessoa)
-- Convenções: church_id em tudo, FKs compostas, RLS habilitada, auditoria só de nomes de colunas.

-- No Supabase real, tabelas novas herdam privilégios padrão; fecha o caso de notification_deliveries (migration 1600).
revoke all on public.notification_deliveries from anon, authenticated;
grant select on public.notification_deliveries to authenticated;

create type public.family_relation as enum ('responsavel','conjuge','filho','outro');
create type public.visitor_status as enum ('novo','em_acompanhamento','integrado','arquivado');
create type public.followup_kind as enum ('ligacao','visita','mensagem','outro');
create type public.finance_kind as enum ('entrada','saida');

-- ===================== Famílias =====================
create table public.families (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id)
);
create trigger trg_families_updated before update on public.families for each row execute function private.set_updated_at();

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  family_id uuid not null,
  membership_id uuid,
  full_name text check (char_length(btrim(full_name)) between 1 and 120),
  relation public.family_relation not null,
  birth_date date check (birth_date is null or (birth_date > date '1900-01-01' and birth_date <= current_date)),
  created_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id, family_id) references public.families (church_id, id) on delete cascade,
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id),
  -- pessoa com conta (membership) OU dependente sem conta (nome), nunca os dois
  check ((membership_id is null) <> (full_name is null))
);
create unique index family_members_one_family_per_membership on public.family_members (church_id, membership_id) where membership_id is not null;
create index family_members_family_idx on public.family_members (church_id, family_id);

create or replace function private.is_family_member(p_church uuid, p_family uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members fm
    where fm.church_id = p_church and fm.family_id = p_family
      and fm.membership_id = private.current_membership_id(p_church));
$$;

-- Menor de 18 anos exige responsável cadastrado na família; o último responsável não sai enquanto houver menor.
create or replace function private.family_minor_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_family uuid; v_church uuid;
begin
  if tg_op = 'DELETE' then v_family := old.family_id; v_church := old.church_id;
  else v_family := new.family_id; v_church := new.church_id; end if;

  if tg_op <> 'DELETE' and new.birth_date is not null and new.birth_date > (current_date - interval '18 years') then
    if new.relation = 'responsavel' then
      raise exception 'menor de idade não pode ser responsável' using errcode = '23514';
    end if;
    if not exists (select 1 from public.family_members r
                   where r.church_id = new.church_id and r.family_id = new.family_id and r.relation = 'responsavel' and r.id <> new.id) then
      raise exception 'cadastre um responsável antes do menor de idade' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.relation = 'responsavel' and new.relation <> 'responsavel') then
    if exists (select 1 from public.family_members m
               where m.church_id = v_church and m.family_id = v_family and m.id <> old.id
                 and m.birth_date > (current_date - interval '18 years'))
       and not exists (select 1 from public.family_members r
                       where r.church_id = v_church and r.family_id = v_family and r.relation = 'responsavel' and r.id <> old.id) then
      raise exception 'a família tem menores: mantenha ao menos um responsável' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_family_minor_guard before insert or update or delete on public.family_members
  for each row execute function private.family_minor_guard();

-- ===================== Visitantes =====================
create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone text check (char_length(phone) between 8 and 30),
  email text check (char_length(email) between 5 and 200 and email like '%_@_%'),
  -- LGPD: só guarda forma de contato com consentimento registrado
  contact_consent_at timestamptz,
  first_visit_on date not null default current_date,
  source text check (char_length(source) <= 120),
  notes text check (char_length(notes) <= 1000),
  status public.visitor_status not null default 'novo',
  assigned_membership_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id, assigned_membership_id) references public.church_memberships (church_id, id),
  check ((phone is null and email is null) or contact_consent_at is not null)
);
create index visitors_church_status_idx on public.visitors (church_id, status, first_visit_on desc);
create trigger trg_visitors_updated before update on public.visitors for each row execute function private.set_updated_at();

create table public.visit_followups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  visitor_id uuid not null,
  kind public.followup_kind not null,
  note text not null check (char_length(btrim(note)) between 1 and 1000),
  done_on date not null default current_date,
  by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id, visitor_id) references public.visitors (church_id, id) on delete cascade,
  foreign key (church_id, by_membership_id) references public.church_memberships (church_id, id)
);
create index visit_followups_visitor_idx on public.visit_followups (church_id, visitor_id, done_on desc);

-- ===================== Células =====================
create table public.cell_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  leader_membership_id uuid not null,
  weekday smallint check (weekday between 0 and 6),
  meeting_time time,
  location text check (char_length(location) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id) references public.churches (id),
  foreign key (church_id, leader_membership_id) references public.church_memberships (church_id, id)
);
create unique index cell_groups_name_idx on public.cell_groups (church_id, lower(name));
create trigger trg_cells_updated before update on public.cell_groups for each row execute function private.set_updated_at();

create table public.cell_members (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  cell_id uuid not null,
  membership_id uuid not null,
  joined_on date not null default current_date,
  unique (church_id, id),
  unique (cell_id, membership_id),
  foreign key (church_id, cell_id) references public.cell_groups (church_id, id) on delete cascade,
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id)
);

create table public.cell_meetings (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  cell_id uuid not null,
  held_on date not null check (held_on <= current_date),
  topic text check (char_length(topic) <= 200),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (church_id, id),
  unique (cell_id, held_on),
  foreign key (church_id, cell_id) references public.cell_groups (church_id, id) on delete cascade
);

create table public.cell_meeting_attendance (
  church_id uuid not null,
  meeting_id uuid not null,
  membership_id uuid not null,
  primary key (meeting_id, membership_id),
  foreign key (church_id, meeting_id) references public.cell_meetings (church_id, id) on delete cascade,
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id)
);

create or replace function private.is_cell_leader(p_church uuid, p_cell uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cell_groups g
                 where g.church_id = p_church and g.id = p_cell and g.leader_membership_id = private.current_membership_id(p_church));
$$;
create or replace function private.is_cell_member(p_church uuid, p_cell uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_cell_leader(p_church, p_cell)
      or exists (select 1 from public.cell_members cm
                 where cm.church_id = p_church and cm.cell_id = p_cell and cm.membership_id = private.current_membership_id(p_church));
$$;

-- Presença só de quem participa da célula (membro ou líder)
create or replace function private.cell_attendance_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_cell uuid;
begin
  select m.cell_id into v_cell from public.cell_meetings m where m.church_id = new.church_id and m.id = new.meeting_id;
  if not exists (select 1 from public.cell_members cm where cm.church_id = new.church_id and cm.cell_id = v_cell and cm.membership_id = new.membership_id)
     and not exists (select 1 from public.cell_groups g where g.church_id = new.church_id and g.id = v_cell and g.leader_membership_id = new.membership_id) then
    raise exception 'presença apenas de participantes da célula' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_cell_attendance_guard before insert on public.cell_meeting_attendance
  for each row execute function private.cell_attendance_guard();

-- ===================== Livro-caixa (sem dado por pessoa) =====================
create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind public.finance_kind not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (church_id, id)
);
create unique index finance_categories_name_idx on public.finance_categories (church_id, kind, lower(name));

create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null,
  kind public.finance_kind not null,
  category_id uuid not null,
  occurred_on date not null check (occurred_on <= current_date and occurred_on > date '2000-01-01'),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  reference text check (char_length(reference) <= 60),
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_reason text check (char_length(voided_reason) between 3 and 200),
  voided_by_membership_id uuid,
  unique (church_id, id),
  foreign key (church_id, category_id) references public.finance_categories (church_id, id),
  foreign key (church_id, created_by_membership_id) references public.church_memberships (church_id, id),
  foreign key (church_id, voided_by_membership_id) references public.church_memberships (church_id, id),
  check ((voided_at is null) = (voided_reason is null) and (voided_at is null) = (voided_by_membership_id is null))
);
create index finance_entries_church_date_idx on public.finance_entries (church_id, occurred_on desc);

-- Lançamento é imutável: a única alteração permitida é o estorno (uma vez); categoria deve ter o mesmo tipo.
create or replace function private.finance_entry_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select c.kind from public.finance_categories c where c.church_id = new.church_id and c.id = new.category_id) is distinct from new.kind then
      raise exception 'categoria incompatível com o tipo do lançamento' using errcode = '23514';
    end if;
    if new.voided_at is not null then raise exception 'lançamento novo não pode nascer estornado' using errcode = '23514'; end if;
    return new;
  end if;
  if old.voided_at is not null then raise exception 'lançamento estornado é imutável' using errcode = '42501'; end if;
  if new.voided_at is null
     or (to_jsonb(new) - 'voided_at' - 'voided_reason' - 'voided_by_membership_id') is distinct from
        (to_jsonb(old) - 'voided_at' - 'voided_reason' - 'voided_by_membership_id') then
    raise exception 'lançamentos só podem ser estornados, nunca editados' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_finance_entry_guard before insert or update on public.finance_entries
  for each row execute function private.finance_entry_guard();

-- Resumo mensal por categoria (ignora estornados). Roda com os privilégios do chamador: a RLS limita a administradores.
create or replace function public.finance_month_summary(p_church uuid, p_year integer, p_month integer)
returns table (category_id uuid, category_name text, kind public.finance_kind, total_cents bigint, entries bigint)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.name, c.kind, coalesce(sum(e.amount_cents), 0)::bigint, count(e.id)::bigint
  from public.finance_categories c
  left join public.finance_entries e
    on e.church_id = c.church_id and e.category_id = c.id and e.voided_at is null
   and e.occurred_on >= make_date(p_year, p_month, 1)
   and e.occurred_on < (make_date(p_year, p_month, 1) + interval '1 month')
  where c.church_id = p_church and p_month between 1 and 12
  group by c.id, c.name, c.kind
  order by c.kind, c.name;
$$;

-- ===================== RLS e privilégios =====================
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.visitors enable row level security;
alter table public.visit_followups enable row level security;
alter table public.cell_groups enable row level security;
alter table public.cell_members enable row level security;
alter table public.cell_meetings enable row level security;
alter table public.cell_meeting_attendance enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_entries enable row level security;

revoke all on public.families, public.family_members, public.visitors, public.visit_followups, public.cell_groups, public.cell_members,
  public.cell_meetings, public.cell_meeting_attendance, public.finance_categories, public.finance_entries from anon, authenticated;
grant select, insert, update, delete on public.families, public.family_members, public.visitors, public.visit_followups,
  public.cell_groups, public.cell_members, public.cell_meetings, public.cell_meeting_attendance to authenticated;
grant select, insert, update on public.finance_categories to authenticated;
grant select, insert on public.finance_entries to authenticated;
grant update (voided_at, voided_reason, voided_by_membership_id) on public.finance_entries to authenticated;
grant execute on function public.finance_month_summary(uuid, integer, integer) to authenticated;
revoke execute on function public.finance_month_summary(uuid, integer, integer) from public, anon;
grant execute on function private.is_family_member(uuid, uuid), private.is_cell_leader(uuid, uuid), private.is_cell_member(uuid, uuid) to authenticated;

-- famílias: administração escreve; administração e quem tem `manage_members` em algum ministério leem; cada família lê a si mesma
create policy families_select on public.families for select to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_members']::public.ministry_permission[]) or private.is_family_member(church_id, id));
create policy families_write_i on public.families for insert to authenticated with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy families_write_u on public.families for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[])) with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy families_write_d on public.families for delete to authenticated using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

create policy family_members_select on public.family_members for select to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_members']::public.ministry_permission[]) or private.is_family_member(church_id, family_id));
create policy family_members_write_i on public.family_members for insert to authenticated with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy family_members_write_u on public.family_members for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[])) with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy family_members_write_d on public.family_members for delete to authenticated using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

-- visitantes: administração e quem tem `manage_members` em algum ministério; exclusão (direito ao apagamento) só administração
create policy visitors_select on public.visitors for select to authenticated using (private.has_any_ministry_permission(church_id, array['manage_members']::public.ministry_permission[]));
create policy visitors_insert on public.visitors for insert to authenticated with check (private.has_any_ministry_permission(church_id, array['manage_members']::public.ministry_permission[]));
create policy visitors_update on public.visitors for update to authenticated
  using (private.has_any_ministry_permission(church_id, array['manage_members']::public.ministry_permission[])) with check (private.has_any_ministry_permission(church_id, array['manage_members']::public.ministry_permission[]));
create policy visitors_delete on public.visitors for delete to authenticated using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

create policy followups_select on public.visit_followups for select to authenticated using (private.has_any_ministry_permission(church_id, array['manage_members']::public.ministry_permission[]));
create policy followups_insert on public.visit_followups for insert to authenticated
  with check (private.has_any_ministry_permission(church_id, array['manage_members']::public.ministry_permission[]) and by_membership_id = private.current_membership_id(church_id));
create policy followups_delete on public.visit_followups for delete to authenticated using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

-- células: todos os membros veem a lista; administração gerencia; líder gerencia a própria célula
create policy cells_select on public.cell_groups for select to authenticated using (private.is_active_member(church_id));
create policy cells_insert on public.cell_groups for insert to authenticated with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy cells_update on public.cell_groups for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[])) with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy cells_delete on public.cell_groups for delete to authenticated using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

create policy cell_members_select on public.cell_members for select to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.is_cell_member(church_id, cell_id));
create policy cell_members_insert on public.cell_members for insert to authenticated
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.is_cell_leader(church_id, cell_id));
create policy cell_members_delete on public.cell_members for delete to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.is_cell_leader(church_id, cell_id)
         or membership_id = private.current_membership_id(church_id));
create policy cell_members_update on public.cell_members for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[])) with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));

create policy cell_meetings_select on public.cell_meetings for select to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.is_cell_member(church_id, cell_id));
create policy cell_meetings_insert on public.cell_meetings for insert to authenticated
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.is_cell_leader(church_id, cell_id));
create policy cell_meetings_update on public.cell_meetings for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.is_cell_leader(church_id, cell_id))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.is_cell_leader(church_id, cell_id));
create policy cell_meetings_delete on public.cell_meetings for delete to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]) or private.is_cell_leader(church_id, cell_id));

create policy cell_att_select on public.cell_meeting_attendance for select to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[])
         or exists (select 1 from public.cell_meetings m where m.church_id = cell_meeting_attendance.church_id and m.id = meeting_id and private.is_cell_member(m.church_id, m.cell_id)));
create policy cell_att_insert on public.cell_meeting_attendance for insert to authenticated
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[])
              or exists (select 1 from public.cell_meetings m where m.church_id = cell_meeting_attendance.church_id and m.id = meeting_id and private.is_cell_leader(m.church_id, m.cell_id)));
create policy cell_att_delete on public.cell_meeting_attendance for delete to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[])
         or exists (select 1 from public.cell_meetings m where m.church_id = cell_meeting_attendance.church_id and m.id = meeting_id and private.is_cell_leader(m.church_id, m.cell_id)));

-- livro-caixa: somente administração; sem DELETE para ninguém
create policy fin_cat_select on public.finance_categories for select to authenticated using (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy fin_cat_insert on public.finance_categories for insert to authenticated with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy fin_cat_update on public.finance_categories for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[])) with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy fin_entry_select on public.finance_entries for select to authenticated using (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy fin_entry_insert on public.finance_entries for insert to authenticated
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]) and created_by_membership_id = private.current_membership_id(church_id));
create policy fin_entry_update on public.finance_entries for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]) and voided_by_membership_id = private.current_membership_id(church_id));

-- auditoria (apenas nomes de colunas alteradas)
create trigger trg_audit_families after insert or update or delete on public.families for each row execute function private.audit_row_change();
create trigger trg_audit_family_members after insert or update or delete on public.family_members for each row execute function private.audit_row_change();
create trigger trg_audit_visitors after insert or update or delete on public.visitors for each row execute function private.audit_row_change();
create trigger trg_audit_cell_groups after insert or update or delete on public.cell_groups for each row execute function private.audit_row_change();
create trigger trg_audit_finance_entries after insert or update on public.finance_entries for each row execute function private.audit_row_change();
create trigger trg_audit_finance_categories after insert or update on public.finance_categories for each row execute function private.audit_row_change();
