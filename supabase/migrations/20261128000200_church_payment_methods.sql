-- IGREJAQUA — recebimento de contribuições na conta de CADA igreja (o IGREJAQUA nunca toca no dinheiro).
-- Fase 1: chave Pix da própria igreja (qualquer banco). O Pix é gerado com a chave da igreja; a tesouraria
--         confirma o recebimento manualmente.
-- Fase 2: conta Mercado Pago da própria igreja conectada por OAuth (confirmação automática). Os tokens ficam
--         cifrados pela aplicação e só o servidor (service role) os lê.

-- ===== Fase 1: chave Pix da igreja =====
-- Reaproveita public.pix_key_type (cpf, cnpj, email, phone, random), criado em 20261126000100.

create table public.church_pix_keys (
  church_id uuid primary key references public.churches(id),
  key_type public.pix_key_type not null,
  pix_key text not null,
  -- Nome e cidade do recebedor exibidos pelo banco do pagador (limites do padrão BR Code do Banco Central).
  recipient_name text not null check (char_length(recipient_name) between 1 and 25 and recipient_name !~ '[[:cntrl:]]'),
  recipient_city text not null check (char_length(recipient_city) between 1 and 15 and recipient_city !~ '[[:cntrl:]]'),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Formato normalizado por tipo (a aplicação também valida dígitos verificadores de CPF/CNPJ).
  constraint church_pix_key_format check (
    (key_type = 'cnpj' and pix_key ~ '^\d{14}$') or
    (key_type = 'cpf' and pix_key ~ '^\d{11}$') or
    (key_type = 'email' and char_length(pix_key) <= 77 and pix_key ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') or
    (key_type = 'phone' and pix_key ~ '^\+55\d{10,11}$') or
    (key_type = 'random' and pix_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  )
);
create trigger trg_church_pix_keys_updated before update on public.church_pix_keys for each row execute function private.set_updated_at();
create trigger trg_audit_church_pix_keys after insert or update or delete on public.church_pix_keys
  for each row execute function private.audit_row_change();

alter table public.church_pix_keys enable row level security;
revoke all on public.church_pix_keys from anon, authenticated;
grant select, insert, update, delete on public.church_pix_keys to authenticated;
-- Membros ativos leem (o Pix gerado para eles contém a chave de qualquer forma); só a administração altera.
create policy pixkey_select on public.church_pix_keys for select to authenticated using (private.is_active_member(church_id));
create policy pixkey_insert on public.church_pix_keys for insert to authenticated with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy pixkey_update on public.church_pix_keys for update to authenticated
  using (private.has_church_role(church_id, array['admin']::public.membership_role[]))
  with check (private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy pixkey_delete on public.church_pix_keys for delete to authenticated using (private.has_church_role(church_id, array['admin']::public.membership_role[]));

-- Antifraude: toda mudança da chave avisa TODA a administração (troca indevida para desviar ofertas).
create or replace function private.notify_admins_pix_key_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid; v_church uuid := coalesce(new.church_id, old.church_id); v_msg text;
begin
  v_msg := case tg_op
    when 'DELETE' then 'A chave Pix da igreja foi removida.'
    else format('A chave Pix da igreja agora é %s (%s), recebedor %s.',
                case new.key_type when 'cnpj' then 'CNPJ' when 'cpf' then 'CPF' when 'email' then 'e-mail' when 'phone' then 'celular' else 'chave aleatória' end,
                case when new.key_type in ('cnpj','cpf') then '***' || right(new.pix_key, 4) else new.pix_key end,
                new.recipient_name)
  end;
  for v_admin in select cm.user_id from public.church_memberships cm where cm.church_id = v_church and cm.role = 'admin' and cm.status = 'active'
  loop
    perform private.notify(v_church, v_admin, 'contribuicao', 'Chave Pix da igreja alterada', v_msg, '/configuracoes', 'pixkey:' || gen_random_uuid()::text);
  end loop;
  return coalesce(new, old);
end $$;
revoke all on function private.notify_admins_pix_key_changed() from public, anon, authenticated;
create trigger trg_church_pix_keys_notify after insert or update or delete on public.church_pix_keys
  for each row execute function private.notify_admins_pix_key_changed();

-- ===== Contribuições pela chave Pix: método e confirmação manual =====
alter table public.pix_charges
  add constraint pix_charges_provider_check check (provider in ('mercadopago', 'pix_key')),
  add column pix_txid text check (pix_txid is null or pix_txid ~ '^[A-Za-z0-9]{1,25}$'),
  add column confirmed_by uuid references public.profiles(id),
  add column confirmed_at timestamptz;

comment on column public.pix_charges.pix_txid is 'Identificador do Pix pela chave da igreja (aparece no extrato de muitos bancos; ajuda a conciliar).';

/**
 * A tesouraria confirma (ou recusa) uma contribuição feita pela chave Pix da igreja, depois de conferir no
 * extrato. Só a administração; só contribuições pela chave e ainda pendentes. A confirmação dispara o aviso
 * existente às administrações (trg_pix_charges_notify_admins).
 */
create or replace function public.review_pix_key_charge(p_church uuid, p_charge uuid, p_received boolean)
returns public.charge_status language plpgsql security definer set search_path = '' as $$
declare v_status public.charge_status;
begin
  if not private.has_church_role(p_church, array['admin']::public.membership_role[]) then
    raise exception 'apenas a administração confirma contribuições' using errcode = '42501';
  end if;
  update public.pix_charges
     set status = case when p_received then 'approved'::public.charge_status else 'cancelled'::public.charge_status end,
         paid_at = case when p_received then now() else null end,
         confirmed_by = (select auth.uid()),
         confirmed_at = now()
   where church_id = p_church and id = p_charge and provider = 'pix_key' and status = 'pending'
  returning status into v_status;
  if v_status is null then raise exception 'contribuição não encontrada ou já revisada' using errcode = 'P0002'; end if;
  return v_status;
end $$;
revoke all on function public.review_pix_key_charge(uuid, uuid, boolean) from public, anon;
grant execute on function public.review_pix_key_charge(uuid, uuid, boolean) to authenticated;

-- ===== Fase 2: conta Mercado Pago da igreja (OAuth) =====
create table public.church_mercadopago_accounts (
  church_id uuid primary key references public.churches(id),
  mp_user_id text not null check (mp_user_id ~ '^\d{1,20}$'),
  -- Cifrados na aplicação (AES-256-GCM, chave fora do banco). Nunca expostos a authenticated.
  access_token_enc text not null check (char_length(access_token_enc) <= 4096),
  refresh_token_enc text not null check (char_length(refresh_token_enc) <= 4096),
  token_expires_at timestamptz not null,
  live_mode boolean not null,
  connected_by uuid references public.profiles(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_church_mp_accounts_updated before update on public.church_mercadopago_accounts for each row execute function private.set_updated_at();
-- Auditoria registra só os NOMES das colunas alteradas (nunca valores): seguro para tokens cifrados.
create trigger trg_audit_church_mp_accounts after insert or update or delete on public.church_mercadopago_accounts
  for each row execute function private.audit_row_change();

alter table public.church_mercadopago_accounts enable row level security;
revoke all on public.church_mercadopago_accounts from anon, authenticated;
-- Negação explícita para quem está logado (além de não haver grant): só o service role (servidor) lê e grava.
create policy mp_accounts_no_client_access on public.church_mercadopago_accounts for all to authenticated using (false) with check (false);

/** Situação da conexão (sem tokens) para a tela de configurações e para escolher o método de pagamento. */
create or replace function public.church_mercadopago_status(p_church uuid)
returns table (connected boolean, mp_user_id text, connected_at timestamptz, live_mode boolean)
language sql stable security definer set search_path = '' as $$
  select true, a.mp_user_id, a.connected_at, a.live_mode
    from public.church_mercadopago_accounts a
   where a.church_id = p_church and private.is_active_member(p_church)
$$;
revoke all on function public.church_mercadopago_status(uuid) from public, anon;
grant execute on function public.church_mercadopago_status(uuid) to authenticated;

create or replace function private.notify_admins_mp_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid; v_church uuid := coalesce(new.church_id, old.church_id);
begin
  if tg_op = 'UPDATE' and new.mp_user_id = old.mp_user_id then return new; end if; -- renovação de token não avisa
  for v_admin in select cm.user_id from public.church_memberships cm where cm.church_id = v_church and cm.role = 'admin' and cm.status = 'active'
  loop
    perform private.notify(v_church, v_admin, 'contribuicao',
      case when tg_op = 'DELETE' then 'Mercado Pago desconectado' else 'Mercado Pago conectado' end,
      case when tg_op = 'DELETE' then 'As contribuições voltam a usar a chave Pix da igreja (confirmação manual).'
           else format('Contribuições online vão para a conta Mercado Pago %s.', new.mp_user_id) end,
      '/configuracoes', 'mp:' || gen_random_uuid()::text);
  end loop;
  return coalesce(new, old);
end $$;
revoke all on function private.notify_admins_mp_changed() from public, anon, authenticated;
create trigger trg_church_mp_accounts_notify after insert or update or delete on public.church_mercadopago_accounts
  for each row execute function private.notify_admins_mp_changed();
