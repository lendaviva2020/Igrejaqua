-- IGREJAQUA — 0010: notificações in-app geradas por gatilhos (escala publicada, comunicado/devocional publicado)
-- Respeita notification_preferences (canal in_app desligado => não grava). Idempotente por dedupe_key.
create or replace function private.notify(p_church uuid, p_user uuid, p_category text, p_title text, p_body text, p_link text, p_dedupe text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.notification_preferences np
              where np.church_id = p_church and np.user_id = p_user and np.category = p_category
                and np.channel = 'in_app' and not np.enabled) then
    return;
  end if;
  insert into public.notifications (church_id, user_id, category, title, body, link_path, dedupe_key)
  values (p_church, p_user, p_category, left(p_title, 160), left(p_body, 1000), p_link, p_dedupe)
  on conflict (church_id, user_id, dedupe_key) do nothing;
end $$;
revoke all on function private.notify(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function private.notify_lineup_published() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_event uuid; v_title text; v_session text; v_start timestamptz; v_tz text;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return new; end if;
  select cm.user_id into v_user
    from public.ministry_memberships mm join public.church_memberships cm on cm.church_id = mm.church_id and cm.id = mm.membership_id
   where mm.church_id = new.church_id and mm.id = new.ministry_membership_id and cm.status = 'active';
  if v_user is null then return new; end if;
  select e.id, e.title, s.name, s.starts_at, c.timezone into v_event, v_title, v_session, v_start, v_tz
    from public.event_sessions s join public.events e on e.church_id = s.church_id and e.id = s.event_id join public.churches c on c.id = s.church_id
   where s.church_id = new.church_id and s.id = new.session_id;
  perform private.notify(new.church_id, v_user, 'escala', 'Você foi escalado(a)',
    format('%s · %s — %s, %s', v_title, v_session, new.function, to_char(v_start at time zone v_tz, 'DD/MM "às" HH24:MI')),
    '/agenda/' || v_event, 'lineup:' || new.id);
  return new;
end $$;
create trigger trg_lineup_notify after insert or update of status on public.event_lineup
  for each row execute function private.notify_lineup_published();

create or replace function private.notify_content_published() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; v_cat text := case new.kind when 'devotional' then 'devocional' else 'comunicado' end;
begin
  if new.status <> 'published' or new.deleted_at is not null or (tg_op = 'UPDATE' and old.status = 'published') then return new; end if;
  for r in
    select cm.user_id from public.church_memberships cm
     where cm.church_id = new.church_id and cm.status = 'active'
       and cm.id is distinct from new.author_membership_id
       and (new.audience = 'church' or exists (select 1 from public.ministry_memberships mm
              where mm.church_id = cm.church_id and mm.membership_id = cm.id and mm.ministry_id = new.ministry_id and mm.active))
  loop
    perform private.notify(new.church_id, r.user_id, v_cat, new.title, null, '/comunicados', 'content:' || new.id);
  end loop;
  return new;
end $$;
create trigger trg_content_notify after insert or update of status on public.announcements_and_devotionals
  for each row execute function private.notify_content_published();
