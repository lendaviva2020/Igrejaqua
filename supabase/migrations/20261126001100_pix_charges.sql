-- IGREJAQUA — 0011: contribuições online via Pix (Mercado Pago)
-- Dado financeiro por pessoa: visível SOMENTE ao pagador e à administração (R-27 revisada; exige revisão LGPD antes de produção).
-- Mínimo necessário: sem CPF, sem e-mail, sem dados de cartão. O e-mail do pagador vai ao provedor no momento da cobrança e não é guardado aqui.
create type public.charge_status as enum ('pending','approved','rejected','cancelled','expired','refunded');

create table public.pix_charges (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id),
  membership_id uuid not null,
  purpose text not null check (purpose in ('oferta','dizimo','missoes','outro')),
  amount_cents integer not null check (amount_cents between 100 and 5000000),
  status public.charge_status not null default 'pending',
  idempotency_key uuid not null default gen_random_uuid() unique,
  provider text not null default 'mercadopago',
  provider_payment_id text,
  qr_code text check (char_length(qr_code) <= 2048),
  ticket_url text check (char_length(ticket_url) <= 1024),
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  unique (provider, provider_payment_id),
  foreign key (church_id, membership_id) references public.church_memberships (church_id, id)
);
create index pix_charges_church_idx on public.pix_charges (church_id, created_at desc);
create index pix_charges_member_idx on public.pix_charges (church_id, membership_id, created_at desc);
create trigger trg_pix_charges_updated before update on public.pix_charges for each row execute function private.set_updated_at();
create trigger trg_audit_pix_charges after insert or update on public.pix_charges
  for each row execute function private.audit_row_change();

alter table public.pix_charges enable row level security;
revoke all on public.pix_charges from anon, authenticated;
grant select on public.pix_charges to authenticated;
-- O cliente só cria a intenção (valor/finalidade); status, ids do provedor e QR são escritos pelo servidor (service role).
grant insert (church_id, membership_id, purpose, amount_cents) on public.pix_charges to authenticated;

create policy pix_select on public.pix_charges for select to authenticated
  using (membership_id = private.current_membership_id(church_id)
         or private.has_church_role(church_id, array['admin']::public.membership_role[]));
create policy pix_insert on public.pix_charges for insert to authenticated
  with check (membership_id = private.current_membership_id(church_id) and private.is_active_member(church_id));
