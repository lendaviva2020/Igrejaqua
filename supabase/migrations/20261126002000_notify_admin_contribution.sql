-- IGREJAQUA — avisa a administração quando uma contribuição Pix é confirmada.
-- Privacidade: a notificação NÃO identifica o contribuinte (apenas finalidade e valor); o detalhe fica em /contribuir (restrito à administração).
create or replace function private.notify_admins_contribution_approved() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid; v_purpose text;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then return new; end if;
  v_purpose := case new.purpose when 'oferta' then 'oferta' when 'dizimo' then 'dízimo' when 'missoes' then 'missões' else 'outra finalidade' end;
  for v_admin in
    select cm.user_id from public.church_memberships cm where cm.church_id = new.church_id and cm.role = 'admin' and cm.status = 'active'
  loop
    perform private.notify(new.church_id, v_admin, 'contribuicao', 'Contribuição Pix confirmada',
      format('Pix de R$ %s,%s confirmado (%s).', new.amount_cents / 100, lpad((new.amount_cents % 100)::text, 2, '0'), v_purpose),
      '/contribuir', 'pix:' || new.id::text);
  end loop;
  return new;
end $$;
revoke all on function private.notify_admins_contribution_approved() from public, anon, authenticated;
create trigger trg_pix_charges_notify_admins after insert or update of status on public.pix_charges
  for each row execute function private.notify_admins_contribution_approved();
