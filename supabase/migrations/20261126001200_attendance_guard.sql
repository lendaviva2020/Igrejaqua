-- Presença: check-in próprio só na janela da sessão (R-26: 60 min antes do início → fim) e somente de vínculo ativo.
-- Registro por liderança (method 'leader'/'qr') não tem janela, mas exige vínculo ativo da pessoa registrada.
create or replace function private.attendance_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_session public.event_sessions%rowtype;
begin
  if not exists (select 1 from public.church_memberships m
      where m.id = new.membership_id and m.church_id = new.church_id and m.status = 'active') then
    raise exception 'vínculo com a igreja precisa estar ativo' using errcode = '23514';
  end if;
  if new.method = 'self' then
    select * into v_session from public.event_sessions s where s.id = new.session_id and s.church_id = new.church_id;
    if not found then raise exception 'sessão inexistente' using errcode = 'P0002'; end if;
    if now() < v_session.starts_at - interval '60 minutes' or now() > v_session.ends_at then
      raise exception 'check-in fora da janela da sessão' using errcode = '23514';
    end if;
  end if;
  new.checked_in_at := now();
  return new;
end $$;

create trigger trg_attendance_guard before insert on public.attendance_records
  for each row execute function private.attendance_guard();
