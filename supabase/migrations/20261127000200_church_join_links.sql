-- IGREJAQUA — link de entrada da igreja (um link por igreja, compartilhável em grupo) + aprovação pela administração.
-- Decisões do responsável (2026-11-27): quem entra pelo link fica "pending" até um admin aprovar; o link pode ser trocado/desativado.
-- O token fica em claro (diferente do convite por e-mail) para o admin poder copiar o link de novo a qualquer momento:
-- ele só gera um PEDIDO de entrada, sem nenhum acesso, e a leitura é restrita à administração pela RLS.

create table public.church_join_links (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (church_id, id)
);
create unique index church_join_links_one_active_idx on public.church_join_links (church_id) where revoked_at is null;
create index church_join_links_created_by_idx on public.church_join_links (created_by);

alter table public.church_join_links enable row level security;
revoke all on public.church_join_links from anon, authenticated;
grant select on public.church_join_links to authenticated;
create policy join_links_admin_select on public.church_join_links for select to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create trigger trg_audit_church_join_links after insert or update on public.church_join_links
  for each row execute function private.audit_row_change();

-- ---------- Guarda dos vínculos: + exceção estreita para o próprio pedido de entrada ----------
-- Igual à versão da migration 0002, com um único acréscimo no início: dentro de request_church_join
-- (flag local da transação), quem tinha saído ou só fora convidado pode voltar a "pending" como membro comum.
create or replace function private.memberships_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if new.church_id <> old.church_id or new.user_id <> old.user_id then
    raise exception 'church_id e user_id são imutáveis' using errcode = '42501';
  end if;

  if coalesce(current_setting('iq.self_join_request', true), '') = 'on'
     and v_actor is not null and old.user_id = v_actor
     and old.status in ('left','invited') and new.status = 'pending'
     and new.role = 'member' and not new.is_owner then
    return new;
  end if;

  if (new.role, new.is_owner, new.status) is distinct from (old.role, old.is_owner, old.status) then
    if v_actor is not null then
      if not private.has_church_role(old.church_id, array['admin']::public.membership_role[]) then
        raise exception 'apenas admin altera papel/status' using errcode = '42501';
      end if;
      if old.user_id = v_actor and (new.role, new.is_owner) is distinct from (old.role, old.is_owner) then
        raise exception 'não é permitido alterar o próprio papel' using errcode = '42501';
      end if;
      if new.is_owner is distinct from old.is_owner
         and not exists (select 1 from public.church_memberships o
                         where o.church_id = old.church_id and o.user_id = v_actor and o.is_owner and o.status = 'active') then
        raise exception 'apenas owner altera propriedade' using errcode = '42501';
      end if;
    end if;

    if old.status = 'active' and old.role = 'admin' and (new.status <> 'active' or new.role <> 'admin') then
      if not exists (select 1 from public.church_memberships o
                     where o.church_id = old.church_id and o.id <> old.id and o.role = 'admin' and o.status = 'active') then
        raise exception 'a igreja precisa de ao menos um admin ativo' using errcode = '23514';
      end if;
    end if;
    if old.is_owner and old.status = 'active' and (not new.is_owner or new.status <> 'active') then
      if not exists (select 1 from public.church_memberships o
                     where o.church_id = old.church_id and o.id <> old.id and o.is_owner and o.status = 'active') then
        raise exception 'a igreja precisa de ao menos um owner ativo' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------- Gestão do link (somente administração) ----------
create or replace function public.rotate_church_join_link(p_church uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if not private.has_church_role(p_church, array['admin']::public.membership_role[]) then
    raise exception 'apenas a administração gera o link da igreja' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,64}$' then
    raise exception 'token inválido' using errcode = '22023';
  end if;
  update public.church_join_links set revoked_at = now() where church_id = p_church and revoked_at is null;
  insert into public.church_join_links (church_id, token, created_by) values (p_church, p_token, v_actor);
end $$;

create or replace function public.disable_church_join_link(p_church uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_church_role(p_church, array['admin']::public.membership_role[]) then
    raise exception 'apenas a administração desativa o link da igreja' using errcode = '42501';
  end if;
  update public.church_join_links set revoked_at = now() where church_id = p_church and revoked_at is null;
end $$;

-- ---------- Pedido de entrada pelo link ----------
-- Nunca concede acesso: cria/reabre o vínculo como "pending" (membro comum) e avisa a administração.
create or replace function public.request_church_join(p_token text)
returns table (church_id uuid, church_name text, status public.membership_status)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_church uuid; v_name text; v_m public.church_memberships%rowtype; v_requester text; v_admin uuid;
begin
  if v_user is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select l.church_id, c.name into v_church, v_name
    from public.church_join_links l join public.churches c on c.id = l.church_id
   where l.token = p_token and l.revoked_at is null and c.status = 'active';
  if v_church is null then raise exception 'link inválido ou desativado' using errcode = 'P0002'; end if;

  select * into v_m from public.church_memberships m where m.church_id = v_church and m.user_id = v_user for update;
  if found then
    if v_m.status in ('active','pending') then
      return query select v_church, v_name, v_m.status;
      return;
    end if;
    if v_m.status = 'suspended' then
      raise exception 'seu acesso a esta igreja está suspenso; fale com a administração' using errcode = '42501';
    end if;
    perform set_config('iq.self_join_request', 'on', true);
    update public.church_memberships set status = 'pending', role = 'member', is_owner = false where id = v_m.id;
    perform set_config('iq.self_join_request', 'off', true);
  else
    insert into public.church_memberships (church_id, user_id, role, status)
      values (v_church, v_user, 'member', 'pending') returning * into v_m;
  end if;

  select coalesce(p.display_name, p.full_name) into v_requester from public.profiles p where p.id = v_user;
  for v_admin in
    select cm.user_id from public.church_memberships cm where cm.church_id = v_church and cm.role = 'admin' and cm.status = 'active'
  loop
    perform private.notify(v_church, v_admin, 'membros', 'Novo pedido para entrar na igreja',
      format('%s pediu para entrar. Aprove ou recuse em Membros.', coalesce(v_requester, 'Uma pessoa')),
      '/membros', 'join:' || v_m.id::text || ':' || floor(extract(epoch from now()))::bigint::text);
  end loop;
  return query select v_church, v_name, 'pending'::public.membership_status;
end $$;

-- Convite por e-mail também reativa quem estava aguardando aprovação.
create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower((select auth.jwt() ->> 'email'));
  v_inv public.church_invitations%rowtype;
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  if v_user is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select * into v_inv from public.church_invitations
   where token_hash = v_hash and accepted_at is null and expires_at > now() for update;
  if not found then raise exception 'convite inválido ou expirado' using errcode = 'P0002'; end if;
  if lower(v_inv.email::text) <> v_email then
    raise exception 'convite emitido para outro e-mail' using errcode = '42501';
  end if;
  insert into public.church_memberships (church_id, user_id, role, status, invited_by)
  values (v_inv.church_id, v_user, v_inv.role, 'active', v_inv.invited_by)
  on conflict (church_id, user_id) do update
    set status = 'active', role = excluded.role
    where public.church_memberships.status in ('invited','left','pending');
  update public.church_invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_inv.church_id;
end $$;

-- Pedidos do próprio usuário aguardando aprovação (a RLS de churches esconde a igreja de quem ainda não é ativo).
create or replace function public.my_pending_join_requests()
returns table (church_id uuid, church_name text, requested_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.church_id, c.name, m.updated_at
    from public.church_memberships m join public.churches c on c.id = m.church_id
   where m.user_id = (select auth.uid()) and m.status = 'pending' and c.status = 'active'
   order by m.updated_at desc;
$$;

revoke all on function public.rotate_church_join_link(uuid, text), public.disable_church_join_link(uuid), public.request_church_join(text), public.my_pending_join_requests() from public, anon;
grant execute on function public.rotate_church_join_link(uuid, text), public.disable_church_join_link(uuid), public.request_church_join(text), public.my_pending_join_requests() to authenticated;
