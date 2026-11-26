-- Publicação agendada de comunicados/devocionais.
-- As triggers existentes (content_publish_guard, notify_content_published) disparam no UPDATE de status,
-- então a publicação agendada notifica exatamente como a manual.

create or replace function private.publish_due_content(p_church uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  with due as (
    update public.announcements_and_devotionals c
       set status = 'published', published_at = c.publish_at
     where c.status = 'scheduled' and c.publish_at <= now() and c.deleted_at is null
       and (p_church is null or c.church_id = p_church)
    returning 1)
  select count(*) into v_count from due;
  return v_count;
end $$;
revoke all on function private.publish_due_content(uuid) from public, anon, authenticated;

-- Complemento ao cron: ao abrir /comunicados, publica o que já venceu naquela igreja (qualquer membro ativo).
create or replace function public.publish_due_content(p_church uuid) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_active_member(p_church) then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  return private.publish_due_content(p_church);
end $$;
revoke all on function public.publish_due_content(uuid) from public, anon;
grant execute on function public.publish_due_content(uuid) to authenticated;

-- Agendador do banco (pg_cron), a cada minuto. Só se a extensão estiver disponível (Supabase: habilitar em Database > Extensions).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('igrejaqua-publish-due-content', '* * * * *', 'select private.publish_due_content(null)');
  else
    raise notice 'pg_cron indisponível: publicações agendadas só ocorrerão quando alguém abrir /comunicados.';
  end if;
end $$;
